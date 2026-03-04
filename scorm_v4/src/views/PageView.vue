<template>
  <div class="scorm-page">
    <div v-if="!page" class="scorm-card">
      <div class="scorm-muted">Page not found.</div>
    </div>

    <template v-else>
      <div v-for="block in page.blocks" :key="block.id" class="scorm-block" :data-block-id="block.id">
        <BlockRenderer :block="block" @quiz-submitted="onQuizSubmitted" />
      </div>

      <div v-if="showManualComplete" class="scorm-card" style="margin-top:14px">
        <v-btn @click="markThisChapterComplete">Mark chapter complete</v-btn>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, watch } from "vue";
import { useRoute } from "vue-router";

import BlockRenderer from "../blocks/BlockRenderer.vue";
import type { PageModel } from "../engine/course/courseLoader";

import { AppContextKey } from "../engine/appContext";
import { saveProgress, markBlockViewed, markChapterComplete } from "../engine/progress/progressStore";
import { recordQuizAttempt } from "../engine/progress/progressStore";
import { reconcileCourseState } from "../engine/progress/completion";

const route = useRoute();

const ctx = inject(AppContextKey);
if (!ctx) throw new Error("AppContext not provided");
const { course, scorm, state } = ctx;

const page = computed<PageModel | null>(() => {
  if (route.meta?.system) {
    const id = route.meta.systemId as string;
    return course.system?.routes?.find((r) => r.id === id)?.page ?? null;
  }

  const lessonId = route.meta.lessonId as string | undefined;
  const chapterId = route.meta.chapterId as string | undefined;
  if (!lessonId || !chapterId) return null;

  const lesson = course.lessons.find((l) => l.id === lessonId);
  const ch = lesson?.chapters.find((c) => c.id === chapterId);
  return ch?.page ?? null;
});

const showManualComplete = computed(() => {
  const lessonId = route.meta.lessonId as string | undefined;
  const chapterId = route.meta.chapterId as string | undefined;
  if (!lessonId || !chapterId) return false;
  const ch = course.lessons.find((l) => l.id === lessonId)?.chapters.find((c) => c.id === chapterId);
  return ch?.completion?.mode === "manual";
});

function getCurrentChapter() {
  const lessonId = route.meta.lessonId as string | undefined;
  const chapterId = route.meta.chapterId as string | undefined;
  if (!lessonId || !chapterId) return null;

  const lesson = course.lessons.find((l) => l.id === lessonId);
  const ch = lesson?.chapters.find((c) => c.id === chapterId);
  if (!lesson || !ch) return null;

  return { lessonId, chapterId, lesson, ch };
}

function isChapterDone(): boolean {
  const info = getCurrentChapter();
  if (!info) return false;

  const { lessonId, chapterId, ch } = info;
  const mode = ch.completion?.mode ?? "manual";

  // manual is only via button
  if (mode === "manual") return false;

  const blocks = ch.page.blocks ?? [];

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

  // Do NOT mark chapter complete here.
  // Recompute using "all required items" rule.
  recomputeChapterCompletion();
}

function markThisChapterComplete() {
  const info = getCurrentChapter();
  if (!info) return;

  markChapterComplete(state, info.lessonId, info.chapterId);
  reconcileCourseState({ course, state, scorm, touchedLessonId: info.lessonId });
  saveProgress(scorm, state);
  scorm.commit();
}

// --- viewed tracking (for completion.mode="viewed" or "viewed+quiz") ---
let observer: IntersectionObserver | null = null;

function setupViewedObserver() {
  if (!("IntersectionObserver" in window)) return;

  observer?.disconnect();

  observer = new IntersectionObserver(
    (entries) => {
      const info = getCurrentChapter();
      if (!info) return;

      const { lessonId, chapterId, ch } = info;

      const mode = ch.completion?.mode;
      if (mode !== "viewed" && mode !== "viewed+quiz") return;

      const chKey = `${lessonId}/${chapterId}`;
      let changed = false;

      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        const blockId = el.dataset.blockId || "";
        if (!blockId) continue;

        const blk = ch.page.blocks.find((b) => b.id === blockId);
        if (!blk || blk.requiredView === false) continue;

        const before = (state.viewed[chKey] ?? []).length;
        markBlockViewed(state, chKey, blockId);
        const after = (state.viewed[chKey] ?? []).length;
        if (after !== before) changed = true;
      }

      if (!changed) return;

      // Recompute using "all required items" rule.
      recomputeChapterCompletion();
    },
    { threshold: 0.6 }
  );

  setTimeout(() => {
    document.querySelectorAll<HTMLElement>(".scorm-block[data-block-id]").forEach((el) => observer?.observe(el));
  }, 0);
}

onMounted(() => setupViewedObserver());

watch(
  () => route.fullPath,
  () => setupViewedObserver()
);

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
});
</script>