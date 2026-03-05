// src/engine/progress/unlockRules.ts
import type { CourseModel } from "../course/courseLoader";
import type { ProgressStateV1 } from "./progressStore";

function chapterKey(lessonId: string, chapterId: string) {
  return `${lessonId}/${chapterId}`;
}

function normalizeChapterId(chapterId: string) {
  return chapterId.includes("/") ? chapterId.split("/").pop()! : chapterId;
}

/**
 * NEW behavior:
 * - Lesson 1 unlocked by default
 * - Any other lesson may specify unlockAfterLessonId in JSON
 *   If not specified: falls back to classic linear (previous lesson complete)
 */
export function isLessonUnlocked(course: CourseModel, state: ProgressStateV1, lessonId: string): boolean {
  const idx = course.lessons.findIndex((l) => l.id === lessonId);
  if (idx < 0) return true;

  // Lesson 1 always unlocked
  if (idx === 0) return true;

  const lesson: any = course.lessons[idx];

  // Explicit dependency wins
  if (typeof lesson.unlockAfterLessonId === "string" && lesson.unlockAfterLessonId.length > 0) {
    return state.completedLessons.includes(lesson.unlockAfterLessonId);
  }

  // Fallback: classic linear unlock
  const prev = course.lessons[idx - 1];
  return state.completedLessons.includes(prev.id);
}

/**
 * NEW behavior (explicit chapter locks):
 * - Lesson must be unlocked first
 * - If chapter.free === true => unlocked (once lesson unlocked)
 * - If chapter.locked !== true => unlocked
 * - If chapter.locked === true:
 *     - if unlockAfterChapterId is provided => require that chapter completed
 *     - else require previous chapter completed (default)
 */
export function isChapterUnlocked(
  course: CourseModel,
  state: ProgressStateV1,
  lessonId: string,
  chapterId?: string
): boolean {
  if (!isLessonUnlocked(course, state, lessonId)) return false;
  if (!chapterId) return true;

  const bare = normalizeChapterId(chapterId);

  const lesson = course.lessons.find((l) => l.id === lessonId) as any;
  if (!lesson) return true;

  const idx = lesson.chapters.findIndex((c: any) => c.id === bare);
  if (idx < 0) return true;

  const ch: any = lesson.chapters[idx];

  // Explicit free chapter (bypasses chapter locking)
  if (ch.free === true) return true;

  // Not explicitly locked => unlocked
  if (ch.locked !== true) return true;

  // Locked chapter => needs prerequisite completion
  const prereq: string | undefined =
    typeof ch.unlockAfterChapterId === "string" && ch.unlockAfterChapterId.length > 0
      ? ch.unlockAfterChapterId
      : lesson.chapters[idx - 1]?.id;

  // If no prereq defined (locked first chapter), keep it unlocked to avoid trapping
  if (!prereq) return true;

  return state.completedChapters.includes(chapterKey(lessonId, prereq));
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

export function firstAvailableChapterRouteForLesson(course: CourseModel, state: ProgressStateV1, lessonId: string): string {
  const lesson = course.lessons.find((l) => l.id === lessonId);
  if (!lesson) return "/overview";

  const unlocked = lesson.chapters.find((ch) => isChapterUnlocked(course, state, lessonId, ch.id));
  return unlocked?.route || lesson.chapters[0]?.route || "/overview";
}

export function nearestAvailableChapterRouteForLesson(
  course: CourseModel,
  state: ProgressStateV1,
  lessonId: string,
  requestedChapterId: string
): string {
  const lesson = course.lessons.find((l) => l.id === lessonId);
  if (!lesson) return "/overview";

  const requestedBare = normalizeChapterId(requestedChapterId);
  const requestedIdx = lesson.chapters.findIndex((ch) => ch.id === requestedBare);

  if (requestedIdx <= 0) return firstAvailableChapterRouteForLesson(course, state, lessonId);

  for (let i = requestedIdx - 1; i >= 0; i--) {
    const candidate = lesson.chapters[i];
    if (isChapterUnlocked(course, state, lessonId, candidate.id)) {
      return candidate.route;
    }
  }

  return firstAvailableChapterRouteForLesson(course, state, lessonId);
}
