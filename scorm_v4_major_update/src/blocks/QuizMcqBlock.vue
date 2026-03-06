<template>
  <div class="scorm-card">
    <div v-if="title" class="scorm-h1 scorm-title-sm">{{ title }}</div>

    <div v-for="q in questions" :key="q.id" class="quizBlock__question">
      <div class="quizBlock__prompt">{{ q.prompt }}</div>

      <v-radio-group v-if="!q.multi" v-model="answers[q.id]" :disabled="locked">
        <v-radio v-for="opt in q.options" :key="opt.id" :label="opt.text" :value="opt.id" />
      </v-radio-group>

      <div v-else>
        <v-checkbox
          v-for="opt in q.options"
          :key="opt.id"
          v-model="multiAnswers[q.id]"
          :label="opt.text"
          :value="opt.id"
          hide-details
          :disabled="locked"
        />
      </div>
    </div>

    <div class="scorm-stack quizBlock__result">
      <v-btn :disabled="locked || !canSubmit" @click="submit">Submit</v-btn>

      <!-- If already completed (after refresh), show stored result -->
      <div v-if="locked && existing" class="scorm-muted">
        Score: {{ existing.lastRaw }} / {{ existing.max }} —
        <span :class="existing.passed ? 'scorm-score--pass' : 'scorm-score--fail'">
          {{ existing.passed ? "Passed" : "Failed" }}
        </span>
      </div>

      <!-- Otherwise show the result from this session -->
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
import { reactive, computed, ref, onMounted } from "vue";
import type { ScoreEntry } from "../engine/progress/progressStore";

type McqQuestion = {
  id: string;
  prompt: string;
  options: { id: string; text: string }[];
  correct: string[];
  multi?: boolean;
};

const props = defineProps<{
  type: "quiz.mcq";
  id?: string;
  requiredView?: boolean;

  quizId: string;
  title?: string;

  scoreMax: number;
  passScore: number;
  attemptsAllowed?: number;
  shuffleOptions?: boolean;

  questions: McqQuestion[];

  // NEW: existing stored score (passed in from BlockRenderer)
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

const answers = reactive<Record<string, string | null>>({});
const multiAnswers = reactive<Record<string, string[]>>({});

const submitted = ref(false);
const lastScore = ref(0);

// Lock if we already have a saved attempt (change to props.existing?.passed if you want only lock on pass)
const locked = computed(() => props.existing?.passed === true);

onMounted(() => {
  // Prefill checked options from saved responses (so refresh keeps checkmarks)
  const resp = props.existing?.lastResponses;
  if (!resp) return;

  for (const q of props.questions) {
    const v = resp[q.id];
    if (q.multi) {
      if (Array.isArray(v)) multiAnswers[q.id] = [...v];
    } else {
      if (typeof v === "string") answers[q.id] = v;
    }
  }
});

const canSubmit = computed(() => {
  if (locked.value) return false;
  return props.questions.every((q) => {
    if (q.multi) return (multiAnswers[q.id]?.length ?? 0) > 0;
    return !!answers[q.id];
  });
});

function computeRaw(): number {
  const perQ = 1 / props.questions.length;
  let correctCount = 0;

  for (const q of props.questions) {
    const correct = [...q.correct].sort().join("|");
    const chosen = q.multi ? [...(multiAnswers[q.id] ?? [])].sort().join("|") : (answers[q.id] ?? "");

    if (q.multi) {
      if (chosen === correct) correctCount += 1;
    } else {
      if (chosen === q.correct[0]) correctCount += 1;
    }
  }

  const percent = correctCount * perQ;
  return Math.round(percent * props.scoreMax);
}

function submit() {
  if (locked.value) return;

  const raw = computeRaw();
  lastScore.value = raw;
  submitted.value = true;

  // NEW: capture chosen answers to store in suspend_data
  const responses: Record<string, string | string[]> = {};
  for (const q of props.questions) {
    responses[q.id] = q.multi ? (multiAnswers[q.id] ?? []) : (answers[q.id] ?? "");
  }

  emit("quiz-submitted", { quizId: props.quizId, raw, max: props.scoreMax, passScore: props.passScore, responses });
}
</script>