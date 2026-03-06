import { computed, reactive, ref, type ComputedRef, type Ref } from "vue";
import type { Router } from "vue-router";

import type { RuntimeStore } from "../core/runtime/runtimeStore";
import type { CourseModel } from "../engine/course/courseLoader";
import { buildNav, type NavLesson } from "../engine/navigation/navModel";
import { loadProgress, saveProgress, type ProgressStateV1 } from "../engine/progress/progressStore";
import { installCourseGuards } from "../engine/router/guards";
import {
  createScormClientStrict,
  installScormAutoCommit,
  type ScormClient
} from "./scormClient";
import { writeCourseObjective } from "./scormReporting";

type ScormRuntimeShape = {
  scorm: ScormClient;
  state: ProgressStateV1;
  nav: ComputedRef<NavLesson[]>;
  lockedMessage: Ref<string>;
  cleanup: () => void;
  finishCourse: () => boolean;
};

function toScormDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `PT${h}H${m}M${s}S`;
}

export function useScormRuntime(course: CourseModel, router: Router): RuntimeStore {
  const scorm = createScormClientStrict({
    allowOffline: import.meta.env.DEV,
    offlineStoragePrefix: `course:${course.course.id}`
  });
  const initialized = scorm.initialize();

  if (!initialized) {
    throw new Error("Unable to initialize SCORM runtime.");
  }

  if (!scorm.apiFound) {
    // eslint-disable-next-line no-console
    console.warn("SCORM API not found. Running in offline mode with localStorage persistence.");
  }

  const state = reactive(loadProgress(scorm, course)) as ProgressStateV1;
  const nav = computed(() => buildNav(course, state));
  const lockedMessage = ref("");
  const sessionStartMs = Date.now();

  installCourseGuards({
    router,
    course,
    scorm,
    state,
    onLockedRedirect(msg) {
      lockedMessage.value = msg;
      window.setTimeout(() => (lockedMessage.value = ""), 3500);
    }
  });

  const bookmark = scorm.get("cmi.location") || state.lastRoute || "";
  if (bookmark) {
    try {
      router.replace(bookmark);
    } catch {
      // ignore invalid bookmark
    }
  }

  const uninstallAutoCommit = installScormAutoCommit(scorm, 30000);

  let hasHandledUnload = false;

  const onHidden = () => {
    if (document.visibilityState !== "hidden") return;
    saveProgress(scorm, state);
    scorm.commit();
  };

  document.addEventListener("visibilitychange", onHidden);

  const cleanup = () => {
    document.removeEventListener("visibilitychange", onHidden);
    window.removeEventListener("pagehide", onPageHide);
    uninstallAutoCommit();
  };

  const onPageHide = () => {
    if (hasHandledUnload) return;
    hasHandledUnload = true;

    try {
      saveProgress(scorm, state);
      scorm.commit();
      scorm.terminate();
    } finally {
      cleanup();
    }
  };

  window.addEventListener("pagehide", onPageHide);

  const finishCourse = () => {
    if (!scorm.initialized) return false;

    const allLessonsCompleted = state.completedLessons.length >= course.lessons.length;
    if (!allLessonsCompleted) return false;

    scorm.set("cmi.progress_measure", "1.0000");
    scorm.set("cmi.completion_status", "completed");
    scorm.set("cmi.success_status", "passed");
    scorm.set("cmi.score.scaled", "1.0000");
    scorm.set("cmi.score.raw", "100");
    scorm.set("cmi.score.min", "0");
    scorm.set("cmi.score.max", "100");
    scorm.set("cmi.session_time", toScormDuration(Date.now() - sessionStartMs));
    writeCourseObjective({
      scorm,
      objectiveId: course.course.id,
      completionStatus: "completed",
      successStatus: "passed",
      progressMeasure01: 1,
      scoreScaled01: 1
    });

    saveProgress(scorm, state);
    scorm.commit();
    return scorm.terminate({ exit: "normal" });
  };

  const runtime: ScormRuntimeShape = { scorm, state, nav, lockedMessage, cleanup, finishCourse };
  return { ...runtime, course };
}
