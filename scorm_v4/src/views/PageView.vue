<template>
  <div class="scorm-page">
    <div v-if="!page" class="scorm-card">
      <div class="scorm-muted">Page not found.</div>
    </div>

    <template v-else>
      <div
        v-for="block in page.blocks"
        :key="block.id"
        class="scorm-block"
        :data-block-id="block.id"
      >
        <BlockRenderer :block="block" @quiz-submitted="onQuizSubmitted" />
      </div>

      <div v-if="showManualComplete" class="scorm-card" style="margin-top:14px">
        <v-btn @click="markThisChapterComplete">Mark chapter complete</v-btn>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute } from "vue-router";

import BlockRenderer from "../blocks/BlockRenderer.vue";

import { loadCourse } from "../engine/course/courseLoader";
import type { CourseModel, PageModel } from "../engine/course/courseLoader";

import { createScormClientStrict } from "../scorm/scormClient";
import { loadProgress, saveProgress, markBlockViewed, markChapterComplete } from "../engine/progress/progressStore";
import { reconcileCourseState } from "../engine/progress/completion";
import { recordQuizAttempt } from "../engine/progress/progressStore";

const route = useRoute();
const scorm = createScormClientStrict();

const course = ref<CourseModel | null>(null);

onMounted(async () => {
  course.value = await loadCourse();

  // Track viewed blocks by visibility
  setupViewedObserver();
});

const page = computed<PageModel | null>(() => {
  if (!course.value) return null;

  // system page
  if (route.meta?.system) {
    const id = route.meta.systemId as string;
    return course.value.system?.routes?.find((r) => r.id === id)?.page ?? null;
  }

  // chapter page
  const lessonId = route.meta.lessonId as string | undefined;
  const chapterId = route.meta.chapterId as string | undefined;
  if (!lessonId || !chapterId) return null;

  const lesson = course.value.lessons.find((l) => l.id === lessonId);
  const ch = lesson?.chapters.find((c) => c.id === chapterId);
  return ch?.page ?? null;
});

const showManualComplete = computed(() => {
  if (!course.value) return false;
  const lessonId = route.meta.lessonId as string | undefined;
  const chapterId = route.meta.chapterId as string | undefined;
  if (!lessonId || !chapterId) return false;
  const ch = course.value.lessons.find((l) => l.id === lessonId)?.chapters.find((c) => c.id === chapterId);
  return ch?.completion?.mode === "manual";
});

function onQuizSubmitted(payload: { quizId: string; raw: number; max: number; passScore: number }) {
  if (!course.value) return;

  const state = loadProgress(scorm, course.value);

  // store per-quiz attempt in suspend_data
  recordQuizAttempt({
    state,
    quizId: payload.quizId,
    raw: payload.raw,
    max: payload.max,
    passScore: payload.passScore
  });

  // set SCORM course-level score immediately (aggregation rule)
  reconcileCourseState({ course: course.value, state, scorm, touchedLessonId: route.meta.lessonId as string });

  // chapter completion behavior (default quiz chapters => mark complete on submit if configured)
  const lessonId = route.meta.lessonId as string | undefined;
  const chapterId = route.meta.chapterId as string | undefined;
  if (lessonId && chapterId) {
    const ch = course.value.lessons.find((l) => l.id === lessonId)?.chapters.find((c) => c.id === chapterId);
    const shouldComplete = ch?.completion?.mode === "quiz" || ch?.completion?.mode === "viewed+quiz";
    if (shouldComplete) {
      markChapterComplete(state, lessonId, chapterId);
      reconcileCourseState({ course: course.value, state, scorm, touchedLessonId: lessonId });
    }
  }

  saveProgress(scorm, state);
  scorm.commit();
}

function markThisChapterComplete() {
  if (!course.value) return;
  const lessonId = route.meta.lessonId as string | undefined;
  const chapterId = route.meta.chapterId as string | undefined;
  if (!lessonId || !chapterId) return;

  const state = loadProgress(scorm, course.value);
  markChapterComplete(state, lessonId, chapterId);
  reconcileCourseState({ course: course.value, state, scorm, touchedLessonId: lessonId });
  saveProgress(scorm, state);
  scorm.commit();
}

// --- viewed tracking (for completion.mode="viewed" or "viewed+quiz") ---
let observer: IntersectionObserver | null = null;

function setupViewedObserver() {
  if (!("IntersectionObserver" in window)) return;

  observer = new IntersectionObserver(
    (entries) => {
      if (!course.value) return;

      const lessonId = route.meta.lessonId as string | undefined;
      const chapterId = route.meta.chapterId as string | undefined;
      if (!lessonId || !chapterId) return;

      const ch = course.value.lessons.find((l) => l.id === lessonId)?.chapters.find((c) => c.id === chapterId);
      if (!ch) return;

      const mode = ch.completion?.mode;
      if (mode !== "viewed" && mode !== "viewed+quiz") return;

      const state = loadProgress(scorm, course.value);
      const chKey = `${lessonId}/${chapterId}`;

      let changed = false;

      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        const blockId = el.dataset.blockId || "";
        if (!blockId) continue;

        // Only track blocks that are requiredView=true
        const blk = ch.page.blocks.find((b) => b.id === blockId);
        if (!blk || blk.requiredView === false) continue;

        const before = (state.viewed[chKey] ?? []).length;
        markBlockViewed(state, chKey, blockId);
        const after = (state.viewed[chKey] ?? []).length;
        if (after !== before) changed = true;
      }

      if (!changed) return;

      // If all required-view blocks have been viewed => mark chapter complete
      const requiredIds = ch.page.blocks.filter((b) => b.requiredView !== false).map((b) => b.id!);
      const viewedIds = state.viewed[chKey] ?? [];
      const allViewed = requiredIds.every((id) => viewedIds.includes(id));

      if (allViewed) {
        markChapterComplete(state, lessonId, chapterId);
        reconcileCourseState({ course: course.value, state, scorm, touchedLessonId: lessonId });
      }

      saveProgress(scorm, state);
      scorm.commit();
    },
    { threshold: 0.6 }
  );

  // Observe blocks after render tick
  setTimeout(() => {
    document.querySelectorAll<HTMLElement>(".scorm-block[data-block-id]").forEach((el) => observer?.observe(el));
  }, 0);
}

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
});
</script>