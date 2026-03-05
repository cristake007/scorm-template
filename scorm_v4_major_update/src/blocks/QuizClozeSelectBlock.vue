<template>
  <div class="scorm-card">
    <div v-if="title" class="scorm-h1" style="font-size:16px">{{ title }}</div>

    <div style="line-height:1.8; font-size:16px; margin-top:10px;">
      <template v-for="(part, i) in text" :key="i">
        <span v-if="isText(part)">{{ part.t }}</span>

        <span v-else style="display:inline-block; margin:0 6px;">
          <select class="scorm-select" :disabled="locked" v-model="responses[part.blankId]">
            <option value="" disabled>Select…</option>
            <option v-for="opt in part.options" :key="opt.id" :value="opt.id">
              {{ opt.text }}
            </option>
          </select>
        </span>
      </template>
    </div>

    <div style="display:flex;gap:10px;margin-top:16px;align-items:center;">
      <v-btn :disabled="locked || !canSubmit" @click="submit">Submit</v-btn>

      <div v-if="locked && existing" class="scorm-muted">
        Score: {{ existing.lastRaw }} / {{ existing.max }} —
        <span :style="{ color: existing.passed ? 'var(--quiz-pass)' : 'var(--quiz-fail)', fontWeight: 700 }">
          {{ existing.passed ? "Passed" : "Failed" }}
        </span>
      </div>

      <div v-else-if="submitted" class="scorm-muted">
        Score: {{ lastScore }} / {{ scoreMax }} —
        <span :style="{ color: lastScore >= passScore ? 'var(--quiz-pass)' : 'var(--quiz-fail)', fontWeight: 700 }">
          {{ lastScore >= passScore ? "Passed" : "Failed" }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import type { ScoreEntry } from "../engine/progress/progressStore";

type TextPart = { t: string };
type BlankPart = { blankId: string; options: { id: string; text: string; correct?: boolean }[] };
type ClozeTextPart = TextPart | BlankPart;

const props = defineProps<{
  type: "quiz.clozeSelect";
  id?: string;
  requiredView?: boolean;

  quizId: string;
  title?: string;
  scoreMax: number;
  passScore: number;
  text: ClozeTextPart[];

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

const responses = reactive<Record<string, string>>({});

const locked = computed(() => !!props.existing);

function isText(p: ClozeTextPart): p is TextPart {
  return (p as any).t != null;
}

const blanks = computed<BlankPart[]>(() =>
  props.text.filter((p): p is BlankPart => (p as any).blankId != null)
);

onMounted(() => {
  const saved = props.existing?.lastResponses;
  if (!saved) return;

  for (const b of blanks.value) {
    const v = saved[b.blankId];
    if (typeof v === "string") responses[b.blankId] = v;
  }
});

const canSubmit = computed(() => {
  if (locked.value) return false;
  return blanks.value.every((b) => !!responses[b.blankId]);
});

function computeRaw(): number {
  const total = blanks.value.length || 1;
  let correct = 0;

  for (const b of blanks.value) {
    const chosen = responses[b.blankId];
    const opt = b.options.find((o) => o.id === chosen);
    if (opt?.correct) correct += 1;
  }

  return Math.round((correct / total) * props.scoreMax);
}

function submit() {
  if (locked.value) return;

  const raw = computeRaw();
  lastScore.value = raw;
  submitted.value = true;

  const payloadResponses: Record<string, string | string[]> = {};
  for (const b of blanks.value) payloadResponses[b.blankId] = responses[b.blankId] ?? "";

  emit("quiz-submitted", {
    quizId: props.quizId,
    raw,
    max: props.scoreMax,
    passScore: props.passScore,
    responses: payloadResponses
  });
}
</script>

<style>
.scorm-select {
  padding: 8px 10px;
  border-radius: 0;
  border: 0;
  background: var(--color-surface);
}
</style>