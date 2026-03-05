// src/scorm/scormReporting.ts
import type { ScormClient } from "./scormClient";

type InteractionType = "choice" | "matching" | "fill-in" | "other";

function to01(s: string): boolean {
  return s === "true" || s === "1";
}

export function writeInteraction(params: {
  scorm: ScormClient;
  interactionId: string;              // stable id (use quizId)
  type: InteractionType;
  learnerResponse: string;            // SCORM expects string
  correctResponse?: string;           // optional
  result: "correct" | "wrong" | "neutral";
}) {
  const { scorm, interactionId, type, learnerResponse, correctResponse, result } = params;
  if (!scorm.initialized) return;

  // Pick next index using _count
  const countStr = scorm.get("cmi.interactions._count") || "0";
  const n = Math.max(0, Number.parseInt(countStr, 10) || 0);

  scorm.set(`cmi.interactions.${n}.id`, interactionId);
  scorm.set(`cmi.interactions.${n}.type`, type);
  scorm.set(`cmi.interactions.${n}.learner_response`, learnerResponse);
  scorm.set(`cmi.interactions.${n}.result`, result);

  if (correctResponse) {
    scorm.set(`cmi.interactions.${n}.correct_responses.0.pattern`, correctResponse);
  }

  scorm.commit();
}

export function writeCourseObjective(params: {
  scorm: ScormClient;
  objectiveId: string;                // e.g. course.course.id
  completionStatus: "completed" | "incomplete" | "unknown";
  successStatus: "passed" | "failed" | "unknown";
  progressMeasure01?: number;         // 0..1
  scoreScaled01?: number;             // 0..1
}) {
  const { scorm, objectiveId, completionStatus, successStatus, progressMeasure01, scoreScaled01 } = params;
  if (!scorm.initialized) return;

  // We'll always use objectives.0 (single objective for the whole course)
  const i = 0;
  scorm.set(`cmi.objectives.${i}.id`, objectiveId);
  scorm.set(`cmi.objectives.${i}.completion_status`, completionStatus);
  scorm.set(`cmi.objectives.${i}.success_status`, successStatus);

  if (typeof progressMeasure01 === "number") {
    const pm = Math.max(0, Math.min(1, progressMeasure01));
    scorm.set(`cmi.objectives.${i}.progress_measure`, pm.toFixed(4));
  }

  if (typeof scoreScaled01 === "number") {
    const s = Math.max(0, Math.min(1, scoreScaled01));
    scorm.set(`cmi.objectives.${i}.score.scaled`, s.toFixed(4));
  }

  scorm.commit();
}