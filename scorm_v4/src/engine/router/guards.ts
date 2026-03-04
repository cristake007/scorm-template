import type { Router } from "vue-router";
import type { CourseModel } from "../course/courseLoader";
import type { ScormClient } from "../../scorm/scormClient";
import type { ProgressStateV1 } from "../progress/progressStore";
import { saveProgress } from "../progress/progressStore";
import { highestUnlockedLessonId, firstChapterRouteForLesson, isChapterUnlocked } from "../progress/unlockRules";

export function installCourseGuards(opts: {
  router: Router;
  course: CourseModel;
  scorm: ScormClient;
  state: ProgressStateV1;
  onLockedRedirect?: (msg: string) => void;
}) {
  const { router, course, scorm, state, onLockedRedirect } = opts;

  router.beforeEach((to) => {
    const lessonId = (to.meta?.lessonId as string | undefined) || "";
    const chapterId = (to.meta?.chapterId as string | undefined) || "";

    // Only guard chapter routes
    if (!lessonId || !chapterId) return true;

    if (!isChapterUnlocked(course, state, lessonId)) {
      const unlockedLesson = highestUnlockedLessonId(course, state);
      const target = firstChapterRouteForLesson(course, unlockedLesson);
      onLockedRedirect?.("Complete the previous lesson to unlock this.");
      return target;
    }

    // Update in-memory pointers
    state.currentLessonId = lessonId;
    state.currentChapterId = `${lessonId}/${chapterId}`;
    state.lastRoute = to.fullPath;

    return true;
  });

  // Bookmark + persist progress on each route change
  router.afterEach((to) => {
    if (!scorm.initialized) return;

    scorm.set("cmi.location", to.fullPath);

    // write suspend_data (commit is handled elsewhere / throttled)
    saveProgress(scorm, state);
  });
}