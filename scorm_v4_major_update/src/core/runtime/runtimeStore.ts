import type { App, InjectionKey, Ref } from "vue";
import type { ComputedRef } from "vue";

import type { CourseModel } from "../../engine/course/courseLoader";
import type { ProgressStateV1 } from "../../engine/progress/progressStore";
import type { NavLesson } from "../../engine/navigation/navModel";
import type { ScormClient } from "../../scorm/scormClient";

export type RuntimeStore = {
  course: CourseModel;
  scorm: ScormClient;
  state: ProgressStateV1;
  nav: ComputedRef<NavLesson[]>;
  lockedMessage: Ref<string>;
  ready: Promise<void>;
  cleanup: () => void;
  finishCourse: () => boolean;
};

export const RuntimeStoreKey: InjectionKey<RuntimeStore> = Symbol("RuntimeStore");

export function installRuntimeStore(app: App, runtime: RuntimeStore) {
  app.provide(RuntimeStoreKey, runtime);
}
