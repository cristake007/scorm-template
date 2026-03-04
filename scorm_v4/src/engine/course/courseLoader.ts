// src/engine/course/courseLoader.ts
export type LayoutTokens = {
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
  gap?: "sm" | "md" | "lg";
};

export type ChapterCompletionMode = "manual" | "viewed" | "quiz" | "viewed+quiz";

export type ChapterCompletion = {
  mode?: ChapterCompletionMode; // default: "manual" if quiz exists => "quiz" else "viewed"
};

export type BlockBase = {
  type: string;
  id?: string; // recommended for viewed tracking
  requiredView?: boolean; // default true for content blocks; false for decorative blocks
};

// ---- Basic content blocks ----
export type TextBlock = BlockBase & {
  type: "text";
  text: string;
  variant?: "body" | "muted" | "h1" | "h2";
};

export type ImageBlock = BlockBase & {
  type: "image";
  src: string;
  alt?: string;
  ratio?: "16/9" | "4/3" | "1/1";
  rounded?: "md" | "lg" | "xl";
};

// ---- YouTube video block (online) ----
export type YouTubeBlock = BlockBase & {
  type: "video.youtube";
  title?: string;

  /**
   * embed  -> render an iframe inside the course
   * link   -> render a thumbnail + button that opens a new tab
   */
  mode?: "embed" | "link";

  /** For embed mode (preferred). Either videoId or embedUrl must be provided. */
  videoId?: string;
  embedUrl?: string;

  /** For link mode. If omitted, the UI will derive it from videoId/embedUrl when possible. */
  url?: string;

  start?: number;
  privacyMode?: boolean;
};

// ---- Quiz blocks (scored) ----
export type McqQuestion = {
  id: string;
  prompt: string;
  options: { id: string; text: string }[];
  correct: string[]; // option ids
  multi?: boolean; // if true, user must select all correct
};

export type QuizOnSubmit = {
  markChapterComplete?: boolean; // default false
  commit?: boolean; // default true
};

export type McqQuizBlock = BlockBase & {
  type: "quiz.mcq";
  quizId: string;
  title?: string;
  scoreMax: number; // e.g., 100
  passScore: number; // e.g., 80
  attemptsAllowed?: number; // 0 or undefined => unlimited
  shuffleOptions?: boolean;
  questions: McqQuestion[];
  onSubmit?: QuizOnSubmit;
};

export type Block = TextBlock | ImageBlock | YouTubeBlock | McqQuizBlock;

export type PageModel = {
  layout?: LayoutTokens;
  blocks: Block[];
};

export type CourseChapter = {
  id: string;
  title: string;
  route: string;
  required?: boolean; // default true
  completion?: ChapterCompletion;
  page: PageModel;
};

export type CourseLesson = {
  id: string;
  title: string;
  chapters: CourseChapter[];
};

export type SystemRoute = {
  id: string;
  title: string;
  route: string;
  page: PageModel;
};

export type ScoringConfig = {
  aggregation?: "best" | "latest" | "average";
  passRule?: { mode: "anyQuizPassed" } | { mode: "overallPercentAtLeast"; value: number };
};

export type CourseModel = {
  course: { id: string; title: string; version: string };
  system?: { routes?: SystemRoute[]; fallbackRoute?: string };
  unlockMode?: "linear";
  completionMode?: "requiredChapters";
  scoring?: ScoringConfig;
  lessons: CourseLesson[];
};

function normalizeBlockIds(chRoute: string, blocks: Block[]) {
  for (const b of blocks) {
    if (b.type === "video.youtube") {
      const yt = b as any;
      const mode = (yt.mode ?? "embed") as "embed" | "link";

      if (mode === "embed") {
        if (!yt.videoId && !yt.embedUrl) {
          throw new Error(
            `video.youtube block (mode: embed) must have videoId or embedUrl (route: ${chRoute})`
          );
        }
      } else {
        if (!yt.url && !yt.videoId && !yt.embedUrl) {
          throw new Error(
            `video.youtube block (mode: link) must have url OR videoId/embedUrl (route: ${chRoute})`
          );
        }
      }
    }
  }

  // Assign stable ids if missing: based on order + type
  blocks.forEach((b, idx) => {
    if (!b.id) b.id = `${chRoute}::${b.type}::${idx + 1}`;
    if (b.requiredView == null) b.requiredView = true;
  });
}


export async function loadCourse(): Promise<CourseModel> {
  const mod = await import("../../content/course.json");
  const course = mod.default as CourseModel;

  course.unlockMode ??= "linear";
  course.completionMode ??= "requiredChapters";
  course.scoring ??= { aggregation: "best", passRule: { mode: "anyQuizPassed" } };

  course.system ??= { routes: [], fallbackRoute: "/overview" };
  course.system.routes ??= [];

  // Validate + normalize chapters
  for (const lesson of course.lessons) {
    for (const ch of lesson.chapters) {
      ch.required = ch.required ?? true;
      if (!ch.route?.startsWith("/")) throw new Error(`Chapter route must start with "/": ${lesson.id}/${ch.id}`);
      if (!ch.page?.blocks?.length) throw new Error(`Missing page.blocks for ${lesson.id}/${ch.id}`);

      // assign block ids for viewed tracking
      normalizeBlockIds(ch.route, ch.page.blocks);

      // default completion mode:
      const hasQuiz = ch.page.blocks.some((b) => b.type.startsWith("quiz."));
      const mode = ch.completion?.mode;
      if (!mode) {
        ch.completion = { mode: hasQuiz ? "quiz" : "viewed" };
      }
    }
  }

  // Validate system routes too
  for (const r of course.system.routes) {
    if (!r.route?.startsWith("/")) throw new Error(`System route must start with "/": ${r.id}`);
    if (!r.page?.blocks?.length) throw new Error(`Missing system page.blocks for ${r.id}`);
    normalizeBlockIds(r.route, r.page.blocks);
  }

  return course;
}