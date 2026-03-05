// src/engine/router/guards.ts
import type { Router } from "vue-router";
import type { CourseModel } from "../course/courseLoader";
import type { ScormClient } from "../../scorm/scormClient";
import type { ProgressStateV1 } from "../progress/progressStore";
import { saveProgress } from "../progress/progressStore";

import { isChapterUnlocked, highestUnlockedLessonId, firstChapterRouteForLesson } from "../progress/unlockRules";

export function installCourseGuards(opts: {
  router: Router;
  course: CourseModel;
  scorm: ScormClient;
  state: ProgressStateV1;
  onLockedRedirect?: (msg: string) => void;
}) {
  const { router, course, scorm, state, onLockedRedirect } = opts;

  // ---- Route-change commit throttling (bookmark reliability) ----
  const COMMIT_THROTTLE_MS = 8000;
  let lastCommitAt = 0;
  let pendingTimer: number | null = null;

  function commitThrottled() {
    if (!scorm.initialized) return;

    const now = Date.now();
    const since = now - lastCommitAt;

    if (since >= COMMIT_THROTTLE_MS) {
      scorm.commit();
      lastCommitAt = now;

      if (pendingTimer != null) {
        window.clearTimeout(pendingTimer);
        pendingTimer = null;
      }
      return;
    }

    if (pendingTimer != null) return;

    pendingTimer = window.setTimeout(() => {
      pendingTimer = null;
      if (!scorm.initialized) return;

      scorm.commit();
      lastCommitAt = Date.now();
    }, COMMIT_THROTTLE_MS - since);
  }

  // 2-a) Enforce linear unlock BEFORE allowing navigation
  router.beforeEach((to) => {
    // Allow system routes freely
    if (to.meta?.system) return true;

    const lessonId = (to.meta?.lessonId as string | undefined) || "";
    const chapterId = (to.meta?.chapterId as string | undefined) || "";

    // Only enforce lock on chapter routes (lessonId+chapterId)
    if (lessonId && chapterId) {
      const unlocked = isChapterUnlocked(course, state, lessonId, chapterId);

      if (!unlocked) {
        const highest = highestUnlockedLessonId(course, state);
        const redirectTo = firstChapterRouteForLesson(course, highest);

        onLockedRedirect?.("Complete previous lesson to unlock this.");

        // Prevent accidental redirect loops
        if (to.fullPath === redirectTo) return true;
        return redirectTo;
      }

      // 2-b) Normalize chapterId for state storage (avoid double-prefix if JSON ever changes)
      state.currentLessonId = lessonId;
      state.currentChapterId = chapterId.includes("/") ? chapterId : `${lessonId}/${chapterId}`;
    }

    state.lastRoute = to.fullPath;
    return true;
  });

  // Bookmark + persist progress on each route change
  router.afterEach((to) => {
    if (!scorm.initialized) return;

    // Bookmark
    scorm.set("cmi.location", to.fullPath);

    // Persist suspend_data (state)
    saveProgress(scorm, state);

    // Throttled commit for route-change saves
    commitThrottled();
  });
}