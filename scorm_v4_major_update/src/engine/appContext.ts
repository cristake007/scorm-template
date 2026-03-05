// src/engine/appContext.ts
import type { InjectionKey } from "vue";
import type { CourseModel } from "./course/courseLoader";
import type { ScormClient } from "../scorm/scormClient";
import type { ProgressStateV1 } from "./progress/progressStore";

export type AppContext = {
  course: CourseModel;
  scorm: ScormClient;
  state: ProgressStateV1;
};

export const AppContextKey: InjectionKey<AppContext> = Symbol("AppContext");