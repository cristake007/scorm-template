import type { Router } from "vue-router";
import type { CourseModel } from "../course/courseLoader";
import type { ScormClient } from "../../scorm/scormClient";
import type { ProgressStateV1 } from "../progress/progressStore";
import { saveProgress } from "../progress/progressStore";


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

    router.beforeEach((to) => {
      const lessonId = (to.meta?.lessonId as string | undefined) || "";
      const chapterId = (to.meta?.chapterId as string | undefined) || "";

      // Update pointers only for chapter routes
      if (lessonId && chapterId) {
        state.currentLessonId = lessonId;
        state.currentChapterId = `${lessonId}/${chapterId}`;
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