import type { CourseModel } from "../course/courseLoader";
import type { ProgressStateV1 } from "../progress/progressStore";

export type NavChapter = {
  lessonId: string;
  chapterId: string;
  title: string;
  route: string;
  required: boolean;
  completed: boolean;
};

export type NavLesson = {
  lessonId: string;
  title: string;
  unlocked: boolean;
  completed: boolean;
  chapters: NavChapter[];
};

export function buildNav(course: CourseModel, state: ProgressStateV1): NavLesson[] {
  return course.lessons.map((lesson) => {
    const chapters: NavChapter[] = lesson.chapters.map((ch) => {
      const key = `${lesson.id}/${ch.id}`;

      return {
        lessonId: lesson.id,
        chapterId: ch.id,
        title: ch.title,
        route: ch.route,
        required: ch.required ?? true,

        // IMPORTANT: quiz chapters are never considered "completed"
        completed: state.completedChapters.includes(key)
      };
    });

    return {
      lessonId: lesson.id,
      title: lesson.title,

      // No gating anymore
      unlocked: true,

      // Keep legacy "completed" if you want, but with quiz chapters never complete,
      // this will typically never be true for quiz lessons.
      completed: state.completedLessons.includes(lesson.id),

      chapters
    };
  });
}
