<template>
  <div class="scorm-card">
    <div v-if="title" class="scorm-h1" style="font-size:16px">{{ title }}</div>

    <div v-for="q in questions" :key="q.id" style="margin-top:14px">
      <div style="font-weight:600;margin-bottom:8px">{{ q.prompt }}</div>

      <v-radio-group v-if="!q.multi" v-model="answers[q.id]">
        <v-radio
          v-for="opt in q.options"
          :key="opt.id"
          :label="opt.text"
          :value="opt.id"
        />
      </v-radio-group>

      <div v-else>
        <v-checkbox
          v-for="opt in q.options"
          :key="opt.id"
          v-model="multiAnswers[q.id]"
          :label="opt.text"
          :value="opt.id"
          hide-details
        />
      </div>
    </div>

    <div style="display:flex;gap:10px;margin-top:16px;align-items:center;">
      <v-btn :disabled="!canSubmit" @click="submit">Submit</v-btn>

      <div v-if="submitted" class="scorm-muted">
        Score: {{ lastScore }} / {{ scoreMax }} — {{ lastScore >= passScore ? "Passed" : "Failed" }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed, ref } from "vue";

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
  attemptsAllowed?: number; // 0/unset = unlimited (enforced in engine later)
  shuffleOptions?: boolean;
  questions: McqQuestion[];
  onSubmit?: { markChapterComplete?: boolean; commit?: boolean };
}>();

const emit = defineEmits<{
  (e: "quiz-submitted", payload: { quizId: string; raw: number; max: number; passScore: number }): void;
}>();

const answers = reactive<Record<string, string | null>>({});
const multiAnswers = reactive<Record<string, string[]>>({});

const submitted = ref(false);
const lastScore = ref(0);

const canSubmit = computed(() => {
  // Basic: ensure each question has an answer
  return props.questions.every((q) => {
    if (q.multi) return (multiAnswers[q.id]?.length ?? 0) > 0;
    return !!answers[q.id];
  });
});

function computeRaw(): number {
  // score is proportional, scaled to scoreMax
  const perQ = 1 / props.questions.length;
  let correctCount = 0;

  for (const q of props.questions) {
    const correct = [...q.correct].sort().join("|");
    const chosen = q.multi
      ? [...(multiAnswers[q.id] ?? [])].sort().join("|")
      : (answers[q.id] ?? "");

    if (q.multi) {
      if (chosen === correct) correctCount += 1;
    } else {
      if (chosen === q.correct[0]) correctCount += 1;
    }
  }

  const percent = correctCount * perQ; // 0..1
  return Math.round(percent * props.scoreMax);
}

function submit() {
  const raw = computeRaw();
  lastScore.value = raw;
  submitted.value = true;

  emit("quiz-submitted", { quizId: props.quizId, raw, max: props.scoreMax, passScore: props.passScore });
}
</script>