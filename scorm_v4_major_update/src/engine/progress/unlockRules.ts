// src/engine/progress/unlockRules.ts
import type { CourseModel } from "../course/courseLoader";
import type { ProgressStateV1 } from "./progressStore";

export function isLessonUnlocked(course: CourseModel, state: ProgressStateV1, lessonId: string): boolean {
  const idx = course.lessons.findIndex((l) => l.id === lessonId);
  if (idx <= 0) return true; // lesson 1 always unlocked
  const prev = course.lessons[idx - 1];
  return state.completedLessons.includes(prev.id);
}

export function isChapterUnlocked(
  course: CourseModel,
  state: ProgressStateV1,
  lessonId: string,
  _chapterId?: string
) {
  // for linear unlock, chapter unlock == lesson unlock
  // (lesson 0 always; lesson N if lesson N-1 complete)
  return isLessonUnlocked(course, state, lessonId);
}

export function highestUnlockedLessonId(course: CourseModel, state: ProgressStateV1): string {
  let last = course.lessons[0]?.id ?? "";
  for (const lesson of course.lessons) {
    if (isLessonUnlocked(course, state, lesson.id)) last = lesson.id;
    else break;
  }
  return last;
}

export function firstChapterRouteForLesson(course: CourseModel, lessonId: string): string {
  const lesson = course.lessons.find((l) => l.id === lessonId);
  return lesson?.chapters[0]?.route || "/overview";
}