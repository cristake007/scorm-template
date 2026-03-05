import { computed, reactive, ref, type ComputedRef, type Ref } from "vue";
import type { Router } from "vue-router";

import type { CourseModel } from "../engine/course/courseLoader";
import { buildNav, type NavLesson } from "../engine/navigation/navModel";
import { loadProgress, saveProgress, type ProgressStateV1 } from "../engine/progress/progressStore";
import { installCourseGuards } from "../engine/router/guards";
import {
  createScormClientStrict,
  installScormAutoCommit,
  installScormExitHandlers,
  type ScormClient
} from "./scormClient";

export function useScormRuntime(
  course: CourseModel,
  router: Router
): {
  scorm: ScormClient;
  state: ProgressStateV1;
  nav: ComputedRef<NavLesson[]>;
  lockedMessage: Ref<string>;
  cleanup: () => void;
} {
  const scorm = createScormClientStrict({ allowOffline: true, offlineStoragePrefix: `course:${course.course.id}` });
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

  const uninstallExit = installScormExitHandlers(scorm);
  const uninstallAutoCommit = installScormAutoCommit(scorm, 30000);

  const onHidden = () => {
    if (document.visibilityState !== "hidden") return;
    saveProgress(scorm, state);
    scorm.commit();
  };

  document.addEventListener("visibilitychange", onHidden);

  const cleanup = () => {
    document.removeEventListener("visibilitychange", onHidden);
    uninstallAutoCommit();
    uninstallExit();
  };

  return { scorm, state, nav, lockedMessage, cleanup };
}
