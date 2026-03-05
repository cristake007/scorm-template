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
  progress: number;        // 0..1
  progressPercent: number; // 0..100 integer
};

export function buildNav(course: CourseModel, state: ProgressStateV1): NavLesson[] {
  function chapterHasQuiz(ch: any): boolean {
    const blocks = ch?.page?.blocks ?? [];
    return blocks.some((b: any) => typeof b?.type === "string" && b.type.startsWith("quiz."));
  }

  return course.lessons.map((lesson) => {
    const chapters: NavChapter[] = lesson.chapters.map((ch) => {
      const key = `${lesson.id}/${ch.id}`;
      const hasQuiz = chapterHasQuiz(ch);

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

    const total = chapters.length || 1;
    const done = chapters.filter((c) => c.completed).length;
    const progress = done / total;
    const progressPercent = Math.round(progress * 100);

    return {
      lessonId: lesson.id,
      title: lesson.title,

      // No gating anymore
      unlocked: true,

      // Keep legacy "completed" if you want, but with quiz chapters never complete,
      // this will typically never be true for quiz lessons.
      completed: state.completedLessons.includes(lesson.id),

      progress,
      progressPercent,

      chapters
    };
  });
}