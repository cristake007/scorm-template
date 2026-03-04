import type { CourseModel } from "../course/courseLoader";
import type { ProgressStateV1 } from "../progress/progressStore";
import { isLessonUnlocked } from "../progress/unlockRules";

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
    const unlocked = isLessonUnlocked(course, state, lesson.id);
    const completed = state.completedLessons.includes(lesson.id);

    const chapters: NavChapter[] = lesson.chapters.map((ch) => {
      const key = `${lesson.id}/${ch.id}`;
      return {
        lessonId: lesson.id,
        chapterId: ch.id,
        title: ch.title,
        route: ch.route,
        required: ch.required ?? true,
        completed: state.completedChapters.includes(key)
      };
    });

    return {
      lessonId: lesson.id,
      title: lesson.title,
      unlocked,
      completed,
      chapters
    };
  });
}