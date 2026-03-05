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

export type Hotspot = {
  id: string;
  xPct: number;
  yPct: number;
  wPct?: number;
  hPct?: number;
  label?: string;
  text: string;
};

export type HotspotImageBlock = BlockBase & {
  type: "image.hotspots";
  title?: string;
  src: string;
  alt?: string;
  hotspots: Hotspot[];
  requireAllClicks?: boolean;

  // NEW:
  display?: "panel" | "tooltip"; // default "panel"
};

// ✅ NEW: Section (nested blocks)
export type SectionBlock = BlockBase & {
  type: "section";
  title?: string;
  variant?: "card" | "plain"; // default "card"
  padding?: "sm" | "md" | "lg"; // default "md"
  blocks: Block[]; // <-- nested blocks
};

export type DragWordsPart = { t?: string; blankId?: string };

export type DragWordsQuizBlock = BlockBase & {
  type: "quiz.dragWords";
  quizId: string;
  title?: string;
  scoreMax: number;
  passScore: number;
  parts: DragWordsPart[];
  words: { id: string; text: string }[];
  correct: Record<string, string>;
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

// ---- Accordion block (offline) ----
export type AccordionItem = {
  id?: string; // stable tracking id; auto-generated if missing
  title: string;
  body: string;
};

export type AccordionBlock = BlockBase & {
  type: "accordion";
  title?: string;
  items: AccordionItem[];
  requireAllExpanded?: boolean; // default true
};

// ---- Flip card block ----
export type FlipCardBlock = BlockBase & {
  type: "flipcard";
  title?: string;
  front: string;
  back: string;
  requireFlip?: boolean; // default true
};

// ---- Scroll sentinel (end-of-page) ----
export type ScrollSentinelBlock = BlockBase & {
  type: "scroll.sentinel";
  text?: string;
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

// ✅ NEW: Icon list (like your screenshot)
export type IconListBlock = BlockBase & {
  type: "iconList";
  title?: string;
  items: Array<{
    id?: string;
    icon?: "info" | "book" | "check" | "dot";
    label: string;
    text: string;
  }>;
};

export type GridBreakpointCols = {
  sm?: number; // default 1
  md?: number; // >= 960px
  lg?: number; // >= 1280px
  xl?: number; // >= 1920px
};

export type GridItem = {
  id?: string; // optional stable id for the cell (not required)
  span?: number; // column span
  blocks: Block[]; // nested blocks
};

export type GridBlock = BlockBase & {
  type: "layout.grid";
  columns?: GridBreakpointCols; // responsive columns
  gap?: "sm" | "md" | "lg"; // spacing between cells
  items: GridItem[];
};

export type Block =
  | TextBlock
  | ImageBlock
  | YouTubeBlock
  | McqQuizBlock
  | AccordionBlock
  | FlipCardBlock
  | ScrollSentinelBlock
  | HotspotImageBlock
  | DragWordsQuizBlock
  | SectionBlock
  | IconListBlock
  | GridBlock;

export type PageModel = {
  layout?: LayoutTokens;
  blocks: Block[];
};

// ✅ Explicit unlock fields live on the model (not “unknown JSON extras”)
export type CourseChapter = {
  id: string;
  title: string;
  route: string;
  required?: boolean; // default true
  completion?: ChapterCompletion;
  page: PageModel;

  // explicit chapter rules
  locked?: boolean;
  unlockAfterChapterId?: string;
  free?: boolean;
};

export type CourseLesson = {
  id: string;
  title: string;
  chapters: CourseChapter[];

  // explicit lesson rules
  unlockAfterLessonId?: string;
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

  // ✅ allow explicit too
  unlockMode?: "linear" | "explicit";
  completionMode?: "requiredChapters";
  scoring?: ScoringConfig;

  lessons: CourseLesson[];
};

// ✅ UPDATED: now recurses into section.blocks and assigns ids for nested blocks too
function normalizeBlockIds(chRoute: string, blocks: Block[]) {
  // 1) Validate special blocks
  for (const b of blocks) {
    if (b.type === "video.youtube") {
      const yt = b as any;
      const mode = (yt.mode ?? "embed") as "embed" | "link";

      if (mode === "embed") {
        if (!yt.videoId && !yt.embedUrl) {
          throw new Error(`video.youtube block (mode: embed) must have videoId or embedUrl (route: ${chRoute})`);
        }
      } else {
        if (!yt.url && !yt.videoId && !yt.embedUrl) {
          throw new Error(`video.youtube block (mode: link) must have url OR videoId/embedUrl (route: ${chRoute})`);
        }
      }
    }
  }

  // 2) Assign stable ids + requiredView defaults (top level)
  blocks.forEach((b, idx) => {
    if (!b.id) b.id = `${chRoute}::${b.type}::${idx + 1}`;

    if (b.requiredView == null) {
      b.requiredView = !(b.type === "accordion" || b.type === "flipcard");
    }
  });

  // 3) Normalize accordion item ids
  blocks.forEach((b) => {
    if (b.type !== "accordion") return;
    const acc = b as any as { id: string; items: any[] };
    (acc.items ?? []).forEach((it, i) => {
      if (!it.id) it.id = `${acc.id}::item::${i + 1}`;
    });
  });

  // 4) ✅ Recurse into nested blocks (section + grid)
  blocks.forEach((b) => {
    if (b.type === "section") {
      const sec = b as any as { blocks?: Block[] };
      if (sec.blocks?.length) normalizeBlockIds(`${chRoute}::${b.id}`, sec.blocks);
    }

    if (b.type === "layout.grid") {
      const g = b as any as { items?: Array<{ blocks?: Block[] }> };
      (g.items ?? []).forEach((it, i) => {
        if (it.blocks?.length) normalizeBlockIds(`${chRoute}::${b.id}::cell::${i + 1}`, it.blocks);
      });
    }
  });
}

function assertUnique(name: string, key: string, seen: Set<string>) {
  if (seen.has(key)) throw new Error(`Duplicate ${name}: ${key}`);
  seen.add(key);
}

export async function loadCourse(): Promise<CourseModel> {
  const mod = await import("../../content/course.json");
  const course = mod.default as CourseModel;

  // defaults
  course.unlockMode ??= "linear";
  course.completionMode ??= "requiredChapters";
  course.scoring ??= { aggregation: "best", passRule: { mode: "anyQuizPassed" } };

  course.system ??= { routes: [], fallbackRoute: "/overview" };
  course.system.routes ??= [];

  // ---- Validate global uniqueness / collisions ----
  const lessonIdSet = new Set<string>();
  const routeSet = new Set<string>();

  // Validate + normalize system routes first (also reserves routes)
  for (const r of course.system.routes) {
    if (!r.route?.startsWith("/")) throw new Error(`System route must start with "/": ${r.id}`);
    if (!r.page?.blocks?.length) throw new Error(`Missing system page.blocks for ${r.id}`);

    assertUnique("system route", r.route, routeSet);
    normalizeBlockIds(r.route, r.page.blocks);
  }

  // Validate fallbackRoute is sane (don’t hard fail if missing, but warn by throwing a helpful error)
  const fb = course.system.fallbackRoute || "/overview";
  if (!fb.startsWith("/")) throw new Error(`system.fallbackRoute must start with "/": ${fb}`);

  // Build lesson lookup for explicit dependencies
  const lessonIds = new Set(course.lessons.map((l) => l.id));

  // Validate + normalize lessons/chapters
  for (const lesson of course.lessons) {
    if (!lesson.id) throw new Error(`Lesson missing id`);
    assertUnique("lesson id", lesson.id, lessonIdSet);

    // Validate explicit lesson dependency references
    if (course.unlockMode === "explicit" && lesson.unlockAfterLessonId) {
      if (!lessonIds.has(lesson.unlockAfterLessonId)) {
        throw new Error(
          `Lesson ${lesson.id} unlockAfterLessonId references missing lesson: ${lesson.unlockAfterLessonId}`
        );
      }
      if (lesson.unlockAfterLessonId === lesson.id) {
        throw new Error(`Lesson ${lesson.id} unlockAfterLessonId cannot reference itself`);
      }
    }

    const chapterIdSet = new Set<string>();

    // quick chapter lookup within lesson
    const chapterIdsInLesson = new Set<string>(lesson.chapters.map((c) => c.id));

    for (const ch of lesson.chapters) {
      if (!ch.id) throw new Error(`Chapter missing id in ${lesson.id}`);
      assertUnique(`chapter id in ${lesson.id}`, ch.id, chapterIdSet);

      ch.required = ch.required ?? true;

      if (!ch.route?.startsWith("/")) throw new Error(`Chapter route must start with "/": ${lesson.id}/${ch.id}`);
      assertUnique("chapter route", ch.route, routeSet);

      if (!ch.page?.blocks?.length) throw new Error(`Missing page.blocks for ${lesson.id}/${ch.id}`);

      // assign block ids for viewed tracking (✅ also covers nested blocks)
      normalizeBlockIds(ch.route, ch.page.blocks);

      // default completion mode:
      const hasQuiz = ch.page.blocks.some((b) => String((b as any).type).startsWith("quiz."));
      const mode = ch.completion?.mode;
      if (!mode) {
        ch.completion = { mode: hasQuiz ? "quiz" : "viewed" };
      }

      // ---- Explicit chapter lock validation (only when unlockMode=explicit) ----
      if (course.unlockMode === "explicit") {
        if (ch.free === true) {
          // free chapter: must not be "locked" at the same time
          if (ch.locked === true) {
            throw new Error(`Chapter ${lesson.id}/${ch.id} cannot have both free=true and locked=true`);
          }
        }

        if (ch.unlockAfterChapterId) {
          if (!chapterIdsInLesson.has(ch.unlockAfterChapterId)) {
            throw new Error(
              `Chapter ${lesson.id}/${ch.id} unlockAfterChapterId references missing chapter in same lesson: ${ch.unlockAfterChapterId}`
            );
          }
          if (ch.unlockAfterChapterId === ch.id) {
            throw new Error(`Chapter ${lesson.id}/${ch.id} unlockAfterChapterId cannot reference itself`);
          }
        }

        // If explicitly locked, require some way to unlock (either unlockAfterChapterId or a previous chapter exists)
        if (ch.locked === true && ch.free !== true) {
          const idx = lesson.chapters.findIndex((x) => x.id === ch.id);
          const hasPrev = idx > 0 && !!lesson.chapters[idx - 1]?.id;
          const hasExplicitPrereq = !!ch.unlockAfterChapterId;

          if (!hasPrev && !hasExplicitPrereq) {
            throw new Error(
              `Chapter ${lesson.id}/${ch.id} is locked but has no previous chapter and no unlockAfterChapterId`
            );
          }
        }
      }
    }
  }

  return course;
}