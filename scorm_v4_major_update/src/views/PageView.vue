<template>
  <div class="pageRoot">
    <div v-if="title" class="scorm-h1">{{ title }}</div>

    <div v-if="subtitle" class="scorm-muted pageView__subtitle">
      {{ subtitle }}
    </div>

    <div ref="pageEl" class="pageBlocks">
      <div
        v-for="(b, idx) in blocks"
        :key="b.id || idx"
        class="scorm-block"
        :data-block-id="b.id"
      >
        <BlockRenderer :block="b" @viewed-ids="onViewedIds" @quiz-submitted="onQuizSubmitted" />
      </div>
    </div>

    <!-- Manual completion button (if chapter completion.mode === manual) -->
    <div v-if="showManualComplete" class="manualCompleteWrap">
      <v-btn color="primary" variant="flat" @click="onManualComplete">
        Mark chapter complete
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";

import BlockRenderer from "../blocks/BlockRenderer.vue";

import { AppContextKey } from "../engine/appContext";

// ---- helpers: walk nested blocks (section + grid) ----
type AnyBlock = any;

/** Depth-first list of all blocks, including nested blocks inside section + layout.grid */
function flattenBlocks(blocks: AnyBlock[]): AnyBlock[] {
  const out: AnyBlock[] = [];
  const walk = (arr: AnyBlock[]) => {
    for (const b of arr ?? []) {
      out.push(b);
      if (b?.type === "section" && Array.isArray(b.blocks)) {
        walk(b.blocks);
      }
      if (b?.type === "layout.grid" && Array.isArray(b.items)) {
        for (const it of b.items) {
          if (Array.isArray(it?.blocks)) walk(it.blocks);
        }
      }
    }
  };
  walk(blocks ?? []);
  return out;
}

function findBlockById(blocks: AnyBlock[], id: string): AnyBlock | undefined {
  return flattenBlocks(blocks).find((b) => b?.id === id);
}

import {
  markChapterComplete,
  recordQuizAttempt,
  reconcileCourseState,
  saveProgress
} from "../engine/progress/progressStore";

const route = useRoute();

const ctx = inject(AppContextKey);
if (!ctx) throw new Error("Missing AppContext");

const { course, state, scorm } = ctx;

const pageEl = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

function getCurrentChapter() {
  const meta: any = route.meta ?? {};
  const lessonId = meta.lessonId as string | undefined;
  const chapterId = meta.chapterId as string | undefined;

  if (!lessonId || !chapterId) return null;

  const lesson = course.lessons.find((l) => l.id === lessonId);
  const ch = lesson?.chapters.find((c) => c.id === chapterId);

  if (!lesson || !ch) return null;

  return { lessonId, chapterId, lesson, ch };
}

const pageModel = computed(() => {
  // System route?
  const meta: any = route.meta ?? {};
  if (meta.system) {
    const systemId = meta.systemId as string;
    const r = (course.system?.routes ?? []).find((x) => x.id === systemId);
    return r?.page ?? null;
  }

  const info = getCurrentChapter();
  return info?.ch?.page ?? null;
});

const blocks = computed(() => pageModel.value?.blocks ?? []);
const title = computed(() => {
  // Support title/subtitle if you have them; otherwise this stays empty
  return "";
});
const subtitle = computed(() => "");

const showManualComplete = computed(() => {
  const info = getCurrentChapter();
  if (!info) return false;
  return (info.ch.completion?.mode ?? "manual") === "manual";
});

function setupViewedObserver() {
  if (!pageEl.value) return;

  if (observer) observer.disconnect();

  observer = new IntersectionObserver(
    (entries) => {
      const info = getCurrentChapter();
      if (!info) return;

      const { lessonId, chapterId, ch } = info;

      for (const e of entries) {
        if (!e.isIntersecting) continue;

        const el = e.target as HTMLElement;
        const blockId = el.dataset.blockId;
        if (!blockId) continue;

        // ✅ IMPORTANT: must find nested blocks too (section/grid children)
        const blk = findBlockById(ch.page.blocks ?? [], blockId);
        if (!blk) continue;

        // ignore decorative blocks
        if (blk.requiredView === false) continue;

        // ignore quiz blocks in "viewed" tracking
        if (String(blk.type).startsWith("quiz.")) continue;

        // record viewed
        const key = `${lessonId}/${chapterId}`;
        const curr = state.viewed[key] ?? [];
        if (!curr.includes(blockId)) {
          state.viewed[key] = [...curr, blockId];
        }
      }

      // after we mark viewed, recompute completion
      recomputeChapterCompletion();
    },
    { threshold: 0.35 }
  );

  // observe all scorm-block wrappers (top + nested)
  const nodes = pageEl.value.querySelectorAll<HTMLElement>(".scorm-block[data-block-id]");
  nodes.forEach((n) => observer?.observe(n));
}

function onViewedIds(ids: string[]) {
  const info = getCurrentChapter();
  if (!info) return;

  const { lessonId, chapterId } = info;
  const key = `${lessonId}/${chapterId}`;

  const curr = state.viewed[key] ?? [];
  let next = curr;

  for (const id of ids) {
    if (!next.includes(id)) next = [...next, id];
  }

  if (next !== curr) state.viewed[key] = next;

  recomputeChapterCompletion();
}

function onManualComplete() {
  const info = getCurrentChapter();
  if (!info) return;

  const { lessonId, chapterId } = info;
  markChapterComplete(state, lessonId, chapterId);

  reconcileCourseState({ course, state, scorm, touchedLessonId: lessonId });
  saveProgress(scorm, state);
  scorm.commit();
}

function isChapterDone(): boolean {
  const info = getCurrentChapter();
  if (!info) return false;

  const { lessonId, chapterId, ch } = info;
  const mode = ch.completion?.mode ?? "manual";

  // manual is only via button
  if (mode === "manual") return false;

  // ✅ IMPORTANT: completion must include nested blocks (section/grid)
  const blocks = flattenBlocks(ch.page.blocks ?? []);

  // A) viewed condition (ignore quizzes)
  const chKey = `${lessonId}/${chapterId}`;
  const requiredViewIds = blocks
    .filter((b: any) => b.requiredView !== false && !String(b.type).startsWith("quiz."))
    .map((b: any) => b.id)
    .filter(Boolean) as string[];

  const viewedIds = state.viewed[chKey] ?? [];
  const viewedOk = requiredViewIds.every((id) => viewedIds.includes(id));

  // B) quiz condition: every quiz block has a score entry
  const quizIds = blocks
    .filter((b: any) => String(b.type).startsWith("quiz."))
    .map((b: any) => b.quizId)
    .filter(Boolean) as string[];

  const quizOk = quizIds.every((qid) => !!state.scores?.[qid]);

  if (mode === "quiz") return quizOk;
  if (mode === "viewed") return viewedOk;
  if (mode === "viewed+quiz") return viewedOk && quizOk;

  return false;
}

function recomputeChapterCompletion() {
  const info = getCurrentChapter();
  if (!info) return;

  const { lessonId, chapterId } = info;

  if (isChapterDone()) {
    markChapterComplete(state, lessonId, chapterId);
  }

  reconcileCourseState({ course, state, scorm, touchedLessonId: lessonId });
  saveProgress(scorm, state);
  scorm.commit();
}


function onQuizSubmitted(payload: {
  quizId: string;
  raw: number;
  max: number;
  passScore: number;
  responses: Record<string, string | string[]>;
}) {
  recordQuizAttempt({
    state,
    quizId: payload.quizId,
    raw: payload.raw,
    max: payload.max,
    passScore: payload.passScore,
    responses: payload.responses
  });

  // Write SCORM interaction(s) for ILIAS reports (SCORM-valid learner_response formats)
  try {
    const isMatch = payload.quizId.includes("match");
    const isCloze = payload.quizId.includes("cloze");
    const passed = payload.raw >= payload.passScore;

    if (isMatch) {
      // SCORM 2004 matching learner_response format:
      // "leftId[.]rightId[,]leftId2[.]rightId2"
      const pairs: string[] = [];
      for (const [k, v] of Object.entries(payload.responses)) {
        pairs.push(`${k}.${String(v)}`);
      }
      // One interaction per quiz
      const n = Number(scorm.get("cmi.interactions._count") || "0");
      scorm.set(`cmi.interactions.${n}.id`, payload.quizId);
      scorm.set(`cmi.interactions.${n}.type`, "matching");
      scorm.set(`cmi.interactions.${n}.learner_response`, pairs.join(","));
      scorm.set(`cmi.interactions.${n}.result`, passed ? "correct" : "wrong");
    } else if (isCloze) {
      // SCORM 2004 fill-in learner_response:
      // "blank1=word1[,]blank2=word2"
      const parts: string[] = [];
      for (const [k, v] of Object.entries(payload.responses)) {
        parts.push(`${k}=${String(v)}`);
      }
      const n = Number(scorm.get("cmi.interactions._count") || "0");
      scorm.set(`cmi.interactions.${n}.id`, payload.quizId);
      scorm.set(`cmi.interactions.${n}.type`, "fill-in");
      scorm.set(`cmi.interactions.${n}.learner_response`, parts.join(","));
      scorm.set(`cmi.interactions.${n}.result`, passed ? "correct" : "wrong");
    } else {
      // default choice
      const n = Number(scorm.get("cmi.interactions._count") || "0");
      scorm.set(`cmi.interactions.${n}.id`, payload.quizId);
      scorm.set(`cmi.interactions.${n}.type`, "choice");
      scorm.set(
        `cmi.interactions.${n}.learner_response`,
        JSON.stringify(payload.responses).slice(0, 250)
      );
      scorm.set(`cmi.interactions.${n}.result`, passed ? "correct" : "wrong");
    }
  } catch {
    // ignore interaction write errors (LMS variance)
  }

  // After quiz submit, recompute completion
  recomputeChapterCompletion();
}

watch(
  () => route.fullPath,
  () => {
    // allow DOM to update then re-bind observer
    window.setTimeout(setupViewedObserver, 0);
  }
);

onMounted(() => {
  setupViewedObserver();
});

onBeforeUnmount(() => {
  if (observer) observer.disconnect();
  observer = null;
});
</script>

