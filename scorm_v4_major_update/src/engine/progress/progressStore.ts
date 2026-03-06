// src/engine/progress/progressStore.ts
import type { ScormClient } from "../../scorm/scormClient";
import type { CourseModel } from "../course/courseLoader";

export type ScoreEntry = {
  attempts: number;
  bestRaw: number;
  lastRaw: number;
  max: number;
  passed: boolean;
  lastAttemptAt: string;
  lastResponses?: Record<string, string | string[]>;
};

export type ProgressStateV1 = {
  schemaVersion: 1;
  courseId: string;

  completedLessons: string[];
  completedChapters: string[]; // "lessonId/chapterId"

  currentLessonId: string;
  currentChapterId: string; // "lessonId/chapterId"
  lastRoute: string;

  // Per-quiz scoring history (compact)
  scores: Record<string, ScoreEntry>;

  // Per-chapter viewed blocks (for "viewed" completion mode)
  viewed: Record<string, string[]>; // chapterKey -> viewedBlockIds[]

  timestamps: { startedAt: string; lastSavedAt: string };
};

const SCHEMA_VERSION = 1;

function nowIso(): string {
  try {
    return new Date().toISOString();
  } catch {
    return "";
  }
}

function safeParse<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
}

function compactForSuspendData(state: ProgressStateV1, includeResponses: boolean): ProgressStateV1 {
  const compactScores = Object.fromEntries(
    Object.entries(state.scores ?? {}).map(([quizId, score]) => [
      quizId,
      {
        attempts: score.attempts,
        bestRaw: score.bestRaw,
        lastRaw: score.lastRaw,
        max: score.max,
        passed: score.passed,
        lastAttemptAt: score.lastAttemptAt,
        ...(includeResponses ? { lastResponses: score.lastResponses ?? {} } : {})
      }
    ])
  );

  return {
    ...state,
    scores: compactScores
  };
}

export function chapterKey(lessonId: string, chapterId: string): string {
  return `${lessonId}/${chapterId}`;
}

export function freshState(courseId: string): ProgressStateV1 {
  const t = nowIso();
  return {
    schemaVersion: 1,
    courseId,
    completedLessons: [],
    completedChapters: [],
    currentLessonId: "",
    currentChapterId: "",
    lastRoute: "",
    scores: {},
    viewed: {},
    timestamps: { startedAt: t, lastSavedAt: t }
  };
}

/**
 * Load state from cmi.suspend_data (single source of truth).
 * If missing/corrupt/different courseId → fresh state.
 */
export function loadProgress(scorm: ScormClient, course: CourseModel): ProgressStateV1 {
  const raw = scorm.get("cmi.suspend_data") || "";
  const parsed = raw ? safeParse<ProgressStateV1>(raw) : null;

  if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION || parsed.courseId !== course.course.id) {
    return freshState(course.course.id);
  }

  // normalize fields (defensive)
  parsed.completedLessons ??= [];
  parsed.completedChapters ??= [];
  parsed.scores ??= {};
  parsed.viewed ??= {};
  parsed.timestamps ??= { startedAt: nowIso(), lastSavedAt: nowIso() };

  return parsed;
}

export function saveProgress(scorm: ScormClient, state: ProgressStateV1): boolean {
  state.timestamps.lastSavedAt = nowIso();

  const fullPayload = safeStringify(compactForSuspendData(state, true));
  const fullWriteOk = scorm.set("cmi.suspend_data", fullPayload);
  if (fullWriteOk) return true;

  const fallbackPayload = safeStringify(compactForSuspendData(state, false));
  const fallbackWriteOk = scorm.set("cmi.suspend_data", fallbackPayload);
  if (fallbackWriteOk) {
    // eslint-disable-next-line no-console
    console.warn(`SCORM: suspend_data exceeded LMS limits, saved compact state without quiz responses (size=${fallbackPayload.length}).`);
    return true;
  }

  const err = scorm.getLastError?.();
  // eslint-disable-next-line no-console
  console.warn(`SCORM: failed to set cmi.suspend_data (size=${fullPayload.length}).`, err);
  return false;
}

export function markChapterComplete(state: ProgressStateV1, lessonId: string, chapterId: string) {
  const key = chapterKey(lessonId, chapterId);
  if (!state.completedChapters.includes(key)) state.completedChapters.push(key);
}

export function markLessonComplete(state: ProgressStateV1, lessonId: string) {
  if (!state.completedLessons.includes(lessonId)) state.completedLessons.push(lessonId);
}

/**
 * Mark a block as viewed for a given chapter (for "viewed" completion mode).
 * Keeps suspend_data compact by storing only block ids.
 */
export function markBlockViewed(state: ProgressStateV1, chapterKeyStr: string, blockId: string) {
  if (!blockId) return;
  const arr = state.viewed[chapterKeyStr] ?? (state.viewed[chapterKeyStr] = []);
  if (!arr.includes(blockId)) arr.push(blockId);
}

/**
 * Update (or create) a per-quiz score entry.
 * - attemptsAllowed=0 means unlimited attempts.
 * - We store attempts, bestRaw, lastRaw, passed.
 */
export function recordQuizAttempt(params: {
  state: ProgressStateV1;
  quizId: string;
  raw: number;
  max: number;
  passScore: number;
  responses?: Record<string, string | string[]>;
}) {
  const { state, quizId, raw, max, passScore, responses } = params;
  const passed = raw >= passScore;

  const existing = state.scores[quizId];
  if (!existing) {
    state.scores[quizId] = {
      attempts: 1,
      bestRaw: raw,
      lastRaw: raw,
      max,
      passed,
      lastAttemptAt: nowIso(),
      lastResponses: responses ?? {}
    };
    return;
  }

  existing.attempts += 1;
  existing.lastRaw = raw;
  existing.max = max;
  existing.bestRaw = Math.max(existing.bestRaw ?? 0, raw);
  existing.passed = existing.passed || passed;
  existing.lastAttemptAt = nowIso();
  if (responses) existing.lastResponses = responses;
}
