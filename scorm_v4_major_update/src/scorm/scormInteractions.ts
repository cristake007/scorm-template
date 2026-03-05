import type { ScormClient } from "./scormClient";

export type InteractionType = "choice" | "matching" | "fill-in" | "other";

type InteractionResult = "correct" | "incorrect" | "neutral" | "unanticipated";

export function safeResponseString(responses: Record<string, string | string[]>) {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(responses)) {
    const val = Array.isArray(v) ? v.join("|") : String(v ?? "");
    const cleanK = k.replace(/[;=\r\n]/g, "");
    const cleanV = val.replace(/[;=\r\n]/g, "");
    parts.push(`${cleanK}=${cleanV}`);
  }

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
  interactionId: string;
  type: InteractionType;
  learnerResponse?: string;
  result: InteractionResult;
  description?: string;
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
  scorm.set(`cmi.interactions.${idx}.type`, cleanText(type, 30));
  scorm.set(`cmi.interactions.${idx}.result`, cleanText(result, 30));
  scorm.set(`cmi.interactions.${idx}.learner_response`, cleanText(learnerResponse, 250));

  if (description != null) {
    scorm.set(`cmi.interactions.${idx}.description`, cleanText(description, 250));
  }

  scorm.commit();
}
