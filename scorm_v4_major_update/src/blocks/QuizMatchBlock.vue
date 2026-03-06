<template>
  <div class="scorm-card">
    <div v-if="title" class="scorm-h1 scorm-title-sm">{{ title }}</div>

    <div class="matchGrid">
      <!-- Left -->
      <div>
        <div class="scorm-muted matchBlock__label">Drag these:</div>
        <div
          v-for="l in leftItems"
          :key="l.leftId"
          class="matchItem"
          draggable="true"
          :aria-disabled="locked"
          @dragstart="onDragStart($event, l.leftId)"
          :class="{ 'is-disabled': locked }"
        >
          {{ l.left }}
        </div>
      </div>

      <!-- Right drop targets -->
      <div>
        <div class="scorm-muted matchBlock__label">Drop onto:</div>
        <div
          v-for="r in rightItems"
          :key="r.rightId"
          class="matchTarget"
          @dragover.prevent
          @drop="onDrop($event, r.rightId)"
        >
          <div class="targetTitle">{{ r.right }}</div>
          <div class="targetValue">
            <span v-if="assignedLeftByRight[r.rightId]">
              {{ leftLabel(assignedLeftByRight[r.rightId]!) }}
            </span>
            <span v-else class="scorm-muted">Drop here…</span>
          </div>
        </div>
      </div>
    </div>

    <div class="scorm-stack quizBlock__result">
      <v-btn :disabled="locked || !canSubmit" @click="submit">Submit</v-btn>

      <div v-if="locked && existing" class="scorm-muted">
        Score: {{ existing.lastRaw }} / {{ existing.max }} —
        <span :class="existing.passed ? 'scorm-score--pass' : 'scorm-score--fail'">
          {{ existing.passed ? "Passed" : "Failed" }}
        </span>
      </div>

      <div v-else-if="submitted" class="scorm-muted">
        Score: {{ lastScore }} / {{ scoreMax }} —
        <span :class="lastScore >= passScore ? 'scorm-score--pass' : 'scorm-score--fail'">
          {{ lastScore >= passScore ? "Passed" : "Failed" }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import type { ScoreEntry } from "../engine/progress/progressStore";

type Pair = { leftId: string; left: string; rightId: string; right: string };

const props = defineProps<{
  type: "quiz.match";
  quizId: string;
  title?: string;
  scoreMax: number;
  passScore: number;
  pairs: Pair[];
  existing?: ScoreEntry | null;
}>();

const emit = defineEmits<{
  (e: "quiz-submitted", payload: {
    quizId: string;
    raw: number;
    max: number;
    passScore: number;
    responses: Record<string, string | string[]>;
  }): void;
}>();

const submitted = ref(false);
const lastScore = ref(0);

const locked = computed(() => !!props.existing);

const draggingLeftId = ref<string>("");

// mapping: rightId -> leftId
const assignedLeftByRight = reactive<Record<string, string>>({});

const leftItems = computed(() => props.pairs.map((p) => ({ leftId: p.leftId, left: p.left })));
const rightItems = computed(() => props.pairs.map((p) => ({ rightId: p.rightId, right: p.right })));

onMounted(() => {
  const saved = props.existing?.lastResponses;
  if (!saved) return;

  for (const p of props.pairs) {
    const v = saved[p.rightId];
    if (typeof v === "string") assignedLeftByRight[p.rightId] = v;
  }
});

function onDragStart(e: DragEvent, leftId: string) {
  if (locked.value) return;

  draggingLeftId.value = leftId;

  // IMPORTANT: enables drop to work reliably across browsers
  try {
    e.dataTransfer?.setData("text/plain", leftId);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  } catch {
    // ignore
  }
}

function onDrop(e: DragEvent, rightId: string) {
  if (locked.value) return;

  let leftId = "";
  try {
    leftId = e.dataTransfer?.getData("text/plain") || "";
  } catch {
    leftId = "";
  }

  if (!leftId) leftId = draggingLeftId.value;
  if (!leftId) return;

  // Ensure each left item is used once
  for (const k of Object.keys(assignedLeftByRight)) {
    if (assignedLeftByRight[k] === leftId) assignedLeftByRight[k] = "";
  }

  assignedLeftByRight[rightId] = leftId;
  draggingLeftId.value = "";
}

function leftLabel(leftId: string) {
  return props.pairs.find((p) => p.leftId === leftId)?.left ?? leftId;
}

const canSubmit = computed(() => {
  if (locked.value) return false;
  return props.pairs.every((p) => !!assignedLeftByRight[p.rightId]);
});

function computeRaw(): number {
  const total = props.pairs.length || 1;
  let correct = 0;
  for (const p of props.pairs) {
    if (assignedLeftByRight[p.rightId] === p.leftId) correct += 1;
  }
  return Math.round((correct / total) * props.scoreMax);
}

function submit() {
  if (locked.value) return;

  const raw = computeRaw();
  lastScore.value = raw;
  submitted.value = true;

  const responses: Record<string, string | string[]> = {};
  for (const p of props.pairs) responses[p.rightId] = assignedLeftByRight[p.rightId] ?? "";

  emit("quiz-submitted", { quizId: props.quizId, raw, max: props.scoreMax, passScore: props.passScore, responses });
}
</script>

