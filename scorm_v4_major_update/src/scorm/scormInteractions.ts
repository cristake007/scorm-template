// scorm_v4/src/scorm/scormInteractions.ts
import type { ScormClient } from "./scormClient";

export type InteractionType = "choice" | "matching" | "fill-in" | "other";


export function safeResponseString(responses: Record<string, string | string[]>) {
  // key=a|b;key2=c
  const parts: string[] = [];
  for (const [k, v] of Object.entries(responses)) {
    const val = Array.isArray(v) ? v.join("|") : String(v ?? "");
    // strip risky characters
    const cleanK = k.replace(/[;=\r\n]/g, "");
    const cleanV = val.replace(/[;=\r\n]/g, "");
    parts.push(`${cleanK}=${cleanV}`);
  }
  // prevent huge strings
  return parts.join(";").slice(0, 1000);
}

function cleanText(s: unknown, max = 250) {
  return String(s ?? "")
    .replace(/[\r\n\t]/g, " ")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, max);
}

export function recordInteraction(params: {
  scorm: ScormClient;
  interactionId: string; // stable, use quizId or quizId:key
  type: InteractionType;
  learnerResponse?: string; // we still write a string
  result: "correct" | "incorrect" | "neutral" | "unanticipated";
  description?: string;     // <-- NEW (human readable)
  correctResponse?: string; // keep optional/disabled for now
}) {
  const { scorm, interactionId, type, learnerResponse, result, description } = params;
  if (!scorm.initialized) return;

  const count = Number.parseInt(scorm.get("cmi.interactions._count") || "0", 10) || 0;

  let idx = -1;
  for (let i = 0; i < count; i++) {
    const id = scorm.get(`cmi.interactions.${i}.id`);
    if (id === interactionId) {
      idx = i;
      break;
    }
  }
  if (idx === -1) idx = count;

  scorm.set(`cmi.interactions.${idx}.id`, cleanText(interactionId, 120));
  scorm.set(`cmi.interactions.${idx}.type`, cleanText(type ?? "other", 30));
  scorm.set(`cmi.interactions.${idx}.result`, cleanText(result ?? "neutral", 30));

  // IMPORTANT: never allow NULL -> always a string
  scorm.set(`cmi.interactions.${idx}.learner_response`, cleanText(learnerResponse, 250));

  // Human readable label for ILIAS reports
  if (description != null) {
    scorm.set(`cmi.interactions.${idx}.description`, cleanText(description, 250));
  }

  scorm.commit();
}