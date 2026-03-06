<template>
  <div class="scorm-card">
    <div v-if="title" class="scorm-h1 scorm-title-sm">{{ title }}</div>

    <!-- Sentence with blanks -->
    <div class="dragWordsBlock__text">
      <template v-for="(p, i) in parts" :key="i">
        <span v-if="p.t">{{ p.t }}</span>

        <span
          v-else
          class="dwBlank"
          :class="{ filled: !!filled[p.blankId], locked }"
          @dragover.prevent="!locked && (dragOver = p.blankId)"
          @dragleave="dragOver = null"
          @drop.prevent="!locked && onDropBlank(p.blankId)"
        >
          <span v-if="filled[p.blankId]" class="dwChip">
            {{ wordLabel(filled[p.blankId]!) }}
            <button v-if="!locked" class="dwX" type="button" @click.stop="clearBlank(p.blankId)">×</button>
          </span>
          <span v-else class="dwHint">{{ dragOver === p.blankId ? "Drop…" : "_____" }}</span>
        </span>
      </template>
    </div>

    <!-- Bank -->
    <div class="dragWordsBlock__bank">
      <div class="scorm-muted dragWordsBlock__bankLabel">Drag these words:</div>

      <div class="dragWordsBlock__words">
        <div
          v-for="w in words"
          :key="w.id"
          class="dragWordsBlock__word"
          draggable="true"
          :aria-disabled="locked || isUsed(w.id)"
          :style="{ opacity: locked || isUsed(w.id) ? 0.5 : 1 }"
          @dragstart="onDragStart(w.id)"
        >
          {{ w.text }}
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

type TextPart = { t: string };
type BlankPart = { blankId: string };
type Part = TextPart | BlankPart;

type Word = { id: string; text: string };

const props = defineProps<{
  type: "quiz.dragWords";
  quizId: string;
  title?: string;

  scoreMax: number;
  passScore: number;

  parts: Part[];
  words: Word[];

  // correct mapping: blankId -> wordId
  correct: Record<string, string>;

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

const locked = computed(() => !!props.existing); // lock after first attempt (like your Cloze/Match)
const submitted = ref(false);
const lastScore = ref(0);

const filled = reactive<Record<string, string>>({});
const draggingWordId = ref<string>("");

const dragOver = ref<string | null>(null);

const blanks = computed(() =>
  props.parts.filter((p): p is BlankPart => (p as any).blankId != null)
);

onMounted(() => {
  const saved = props.existing?.lastResponses;
  if (!saved) return;

  for (const b of blanks.value) {
    const v = saved[b.blankId];
    if (typeof v === "string") filled[b.blankId] = v;
  }
});

function onDragStart(wordId: string) {
  if (locked.value) return;
  draggingWordId.value = wordId;
}

function onDropBlank(blankId: string) {
  const wordId = draggingWordId.value;
  if (!wordId) return;

  // ensure each word used once
  for (const k of Object.keys(filled)) {
    if (filled[k] === wordId) filled[k] = "";
  }
  filled[blankId] = wordId;
  draggingWordId.value = "";
  dragOver.value = null;
}

function clearBlank(blankId: string) {
  filled[blankId] = "";
}

function isUsed(wordId: string) {
  return Object.values(filled).includes(wordId);
}

function wordLabel(wordId: string) {
  return props.words.find((w) => w.id === wordId)?.text ?? wordId;
}

const canSubmit = computed(() => {
  if (locked.value) return false;
  return blanks.value.every((b) => !!filled[b.blankId]);
});

function computeRaw(): number {
  const total = blanks.value.length || 1;
  let correctCount = 0;

  for (const b of blanks.value) {
    const chosen = filled[b.blankId];
    const expected = props.correct[b.blankId];
    if (chosen && expected && chosen === expected) correctCount += 1;
  }

  return Math.round((correctCount / total) * props.scoreMax);
}

function submit() {
  if (locked.value) return;

  const raw = computeRaw();
  lastScore.value = raw;
  submitted.value = true;

  const responses: Record<string, string | string[]> = {};
  for (const b of blanks.value) responses[b.blankId] = filled[b.blankId] ?? "";

  emit("quiz-submitted", { quizId: props.quizId, raw, max: props.scoreMax, passScore: props.passScore, responses });
}
</script>

