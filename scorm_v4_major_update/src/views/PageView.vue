<template>
  <div class="pageRoot" :id="pageDomId">
    <div v-if="title" class="scorm-h1">{{ title }}</div>

    <div v-if="subtitle" class="scorm-muted pageView__subtitle">
      {{ subtitle }}
    </div>

    <div ref="pageEl" class="pageBlocks" :id="`${pageDomId}-blocks`">
      <div
        v-for="(b, idx) in blocks"
        :key="b.id || idx"
        :id="blockDomId(b, idx)"
        class="scorm-block"
        :class="blockClassList(b)"
        :data-block-id="b.id"
        :data-block-index="idx"
        :data-block-type="String(b?.type || 'unknown')"
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
    <div v-if="showFinishCourse" class="finishCourseWrap">
      <v-btn color="primary" variant="flat" :disabled="!courseCompleted" @click="onFinishCourse">
        Finish course
      </v-btn>
      <div v-if="!courseCompleted" class="scorm-muted finishCourseWrap__hint">
        Complete all required lessons before finishing the course.
      </div>
      <div v-if="finishError" class="finishCourseWrap__error">{{ finishError }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";

import BlockRenderer from "../blocks/BlockRenderer.vue";

import { RuntimeStoreKey } from "../core/runtime/runtimeStore";
import { safeResponseString, type InteractionType } from "../scorm/scormInteractions";
import { writeInteraction } from "../scorm/scormReporting";

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

function toCssId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function blockDomId(block: AnyBlock, idx: number) {
  const blockId = block?.id ? toCssId(String(block.id)) : `index-${idx + 1}`;
  return `block-${blockId}`;
}

function blockClassList(block: AnyBlock) {
  return [
    `block-type-${toCssId(String(block?.type || "unknown"))}`,
    block?.id ? `block-id-${toCssId(String(block.id))}` : "block-id-missing"
  ];
}

import {
  markChapterComplete,
  recordQuizAttempt,
  reconcileCourseState,
  saveProgress
} from "../engine/progress/progressStore";

const route = useRoute();

const ctx = inject(RuntimeStoreKey);
if (!ctx) throw new Error("Missing RuntimeStore");

const { course, state, scorm, finishCourse } = ctx;

const pageEl = ref<HTMLElement | null>(null);
const finishError = ref("");
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

const pageDomId = computed(() => {
  const meta: any = route.meta ?? {};
  if (meta.systemId) return `page-system-${toCssId(String(meta.systemId))}`;

  const info = getCurrentChapter();
  if (!info) return "page-unknown";

  return `page-${toCssId(info.lessonId)}-${toCssId(info.chapterId)}`;
});

const showManualComplete = computed(() => {
  const info = getCurrentChapter();
  if (!info) return false;
  return (info.ch.completion?.mode ?? "manual") === "manual";
});

const courseCompleted = computed(() => state.completedLessons.length >= course.lessons.length);

const chapterRoutes = computed(() =>
  course.lessons.flatMap((lesson) => lesson.chapters.map((ch) => ch.route))
);

const showFinishCourse = computed(() => {
  const idx = chapterRoutes.value.findIndex((r) => r === route.path);
  return idx >= 0 && idx === chapterRoutes.value.length - 1;
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



function onFinishCourse() {
  finishError.value = "";
  if (!courseCompleted.value) {
    finishError.value = "Course is not complete yet.";
    return;
  }

  const ok = finishCourse();
  if (!ok) {
    finishError.value = "Could not finalize SCORM session. Please try again.";
  }
}

function resolveQuizMeta(quizId: string): { interactionType: InteractionType; description: string } {
  const info = getCurrentChapter();
  if (!info) {
    return { interactionType: "other", description: `Quiz ${quizId}` };
  }

  const all = flattenBlocks(info.ch.page.blocks ?? []);
  const quizBlock = all.find((b: any) => b?.quizId === quizId);
  const type = String(quizBlock?.type ?? "");

  if (type === "quiz.match" || quizId.includes("match")) {
    return { interactionType: "matching", description: quizBlock?.title || `Matching quiz ${quizId}` };
  }

  if (type === "quiz.cloze" || quizId.includes("cloze")) {
    return { interactionType: "fill-in", description: quizBlock?.title || `Cloze quiz ${quizId}` };
  }

  if (type.startsWith("quiz.")) {
    return { interactionType: "choice", description: quizBlock?.title || `Quiz ${quizId}` };
  }

  return { interactionType: "other", description: quizBlock?.title || `Interaction ${quizId}` };
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

  try {
    const { interactionType, description } = resolveQuizMeta(payload.quizId);

    writeInteraction({
      scorm,
      interactionId: payload.quizId,
      type: interactionType,
      learnerResponse: safeResponseString(payload.responses),
      result: payload.raw >= payload.passScore ? "correct" : "wrong",
      description
    });
  } catch {
    // ignore interaction write errors (LMS variance)
  }

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
