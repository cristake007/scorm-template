import type { ScormClient } from "./scormClient";

type InteractionType = "choice" | "matching" | "fill-in" | "other";

function cleanText(value: unknown, max = 250): string {
  return String(value ?? "")
    .replace(/[\r\n\t]/g, " ")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, max);
}

export function writeInteraction(params: {
  scorm: ScormClient;
  interactionId: string;
  type: InteractionType;
  learnerResponse: string;
  correctResponse?: string;
  description?: string;
  result: "correct" | "incorrect" | "neutral";
}) {
  const { scorm, interactionId, type, learnerResponse, correctResponse, description, result } = params;
  if (!scorm.initialized) return;

  const countStr = scorm.get("cmi.interactions._count") || "0";
  const n = Math.max(0, Number.parseInt(countStr, 10) || 0);

  scorm.set(`cmi.interactions.${n}.id`, cleanText(interactionId, 120));
  scorm.set(`cmi.interactions.${n}.type`, cleanText(type, 30));
  scorm.set(`cmi.interactions.${n}.learner_response`, cleanText(learnerResponse, 250));
  scorm.set(`cmi.interactions.${n}.result`, cleanText(result, 30));

  if (correctResponse) {
    scorm.set(`cmi.interactions.${n}.correct_responses.0.pattern`, cleanText(correctResponse, 250));
  }

  if (description) {
    scorm.set(`cmi.interactions.${n}.description`, cleanText(description, 250));
  }
}

export function writeCourseObjective(params: {
  scorm: ScormClient;
  objectiveId: string;
  completionStatus: "completed" | "incomplete" | "unknown";
  successStatus: "passed" | "failed" | "unknown";
  progressMeasure01?: number;
  scoreScaled01?: number;
}) {
  const { scorm, objectiveId, completionStatus, successStatus, progressMeasure01, scoreScaled01 } = params;
  if (!scorm.initialized) return;

  const i = 0;
  scorm.set(`cmi.objectives.${i}.id`, cleanText(objectiveId, 120));
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
}

/**
 * Optional helper for callers that batch SCORM writes and want an explicit flush point.
 * Commit cadence should stay at the flow level (route throttling, quiz submit end, unload, interval).
 */
export function flushReportingWrites(scorm: ScormClient): boolean {
  if (!scorm.initialized) return false;
  return scorm.commit();
}
