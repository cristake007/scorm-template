// src/engine/progress/completion.ts
import type { CourseModel } from "../course/courseLoader";
import type { ScormClient } from "../../scorm/scormClient";
import type { ProgressStateV1 } from "./progressStore";
import { chapterKey, markLessonComplete } from "./progressStore";
import { writeCourseObjective } from "../../scorm/scormReporting";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

/**
 * Lesson completed when all required chapters in the lesson are completed.
 */
export function evaluateLessonCompletion(course: CourseModel, state: ProgressStateV1, lessonId: string): boolean {
  const lesson = course.lessons.find((l) => l.id === lessonId);
  if (!lesson) return false;

  const required = lesson.chapters.filter((c) => (c.required ?? true));
  const ok = required.every((c) => state.completedChapters.includes(chapterKey(lessonId, c.id)));

  if (ok) markLessonComplete(state, lessonId);
  return ok;
}

/**
 * Course completed when all lessons are completed.
 */
export function isCourseCompleted(course: CourseModel, state: ProgressStateV1): boolean {
  return course.lessons.every((l) => state.completedLessons.includes(l.id));
}

export function applyCourseCompletionToScorm(scorm: ScormClient, completed: boolean) {
  if (!scorm.initialized) return;
  scorm.set("cmi.completion_status", completed ? "completed" : "incomplete");
}

/**
 * Computes a course-level score from per-quiz entries in state.scores and writes to SCORM.
 * This is intentionally simple + deterministic.
 *
 * course.scoring.aggregation:
 * - "best": best percentage across quizzes
 * - "latest": last attempt percentage across quizzes (avg of last scores)
 * - "average": average of best percentages
 *
 * course.scoring.passRule:
 * - mode: "anyQuizPassed" => passed if any quiz entry passed==true
 * - mode: "overallPercentAtLeast" with value => passed if aggregated percent >= value
 */
export function applyAggregatedScoreToScorm(course: CourseModel, state: ProgressStateV1, scorm: ScormClient) {
  if (!scorm.initialized) return;

  const scoring = (course as any).scoring ?? { aggregation: "best", passRule: { mode: "anyQuizPassed" } };
  const aggregation: "best" | "latest" | "average" = scoring.aggregation ?? "best";

  const entries = Object.values(state.scores ?? {});
  if (!entries.length) {
    // No quizzes yet → leave score alone (or set unknown). We'll keep unknown.
    return;
  }

  // Convert each quiz entry to a percent (0..100)
  const bestPercents = entries.map((e) => (e.max > 0 ? (e.bestRaw / e.max) * 100 : 0));
  const lastPercents = entries.map((e) => (e.max > 0 ? (e.lastRaw / e.max) * 100 : 0));

  let percent = 0;
  if (aggregation === "best") {
    percent = Math.max(...bestPercents);
  } else if (aggregation === "latest") {
    percent = sum(lastPercents) / lastPercents.length;
  } else {
    percent = sum(bestPercents) / bestPercents.length;
  }

  percent = clamp(percent, 0, 100);

  // Write SCORM score as 0..100 with min/max
  scorm.setScore({ raw: Math.round(percent), max: 100, min: 0 });

  // Determine pass/fail
  const passRule = scoring.passRule ?? { mode: "anyQuizPassed" as const };
  let passed: boolean | undefined = undefined;

  if (passRule.mode === "anyQuizPassed") {
    passed = entries.some((e) => e.passed);
  } else if (passRule.mode === "overallPercentAtLeast") {
    const threshold = Number(passRule.value ?? 0);
    passed = percent >= threshold;
  }

  if (passed === true) scorm.set("cmi.success_status", "passed");
  if (passed === false) scorm.set("cmi.success_status", "failed");
}

/**
 * Convenience: call this after ANY progress update that might affect lesson/course completion or score.
 */
export function reconcileCourseState(params: {
  course: CourseModel;
  state: ProgressStateV1;
  scorm: ScormClient;
  touchedLessonId?: string;
}) {
  const { course, state, scorm, touchedLessonId } = params;

  if (touchedLessonId) evaluateLessonCompletion(course, state, touchedLessonId);

  // Course completed when all lessons completed
  const completed = isCourseCompleted(course, state);
  applyCourseCompletionToScorm(scorm, completed);

  // Quiz score + success_status (owns cmi.score.*)
  applyAggregatedScoreToScorm(course, state, scorm);

  // --- Progress reporting (owns cmi.progress_measure only) ---
  const requiredChapters = course.lessons
    .flatMap((l) => l.chapters.map((c) => ({ lessonId: l.id, ch: c })))
    .filter((x) => (x.ch.required ?? true))
    .map((x) => `${x.lessonId}/${x.ch.id}`);

  const totalReq = Math.max(1, requiredChapters.length);
  const doneReq = requiredChapters.filter((k) => state.completedChapters.includes(k)).length;

  const pm01 = clamp(doneReq / totalReq, 0, 1);

  if (scorm.initialized) {
    // Maintain completion while progressing
    scorm.set("cmi.completion_status", pm01 >= 0.9999 ? "completed" : "incomplete");

    // SCORM 2004 progress measure: 0..1 string
    scorm.set("cmi.progress_measure", pm01.toFixed(4));

    // Populate SCORM objectives report (single course objective)
    try {
      const ss = scorm.get("cmi.success_status") as any;
      const successStatus = ss === "passed" || ss === "failed" ? ss : "unknown";

      writeCourseObjective({
        scorm,
        objectiveId: (course as any).course?.id ?? "course",
        completionStatus: pm01 >= 0.9999 ? "completed" : "incomplete",
        successStatus,
        progressMeasure01: pm01
      });
    } catch {
      // ignore
    }
  }
}