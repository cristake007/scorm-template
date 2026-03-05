<template>
  <div class="scorm-card">
    <div v-if="title" class="scorm-h1" style="font-size:16px">{{ title }}</div>

    <!-- Sentence with blanks -->
    <div class="dwText" style="margin-top:10px">
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
    <div class="dwBank" style="margin-top:14px">
      <div class="scorm-muted" style="margin-bottom:8px">Drag these words:</div>

      <div class="dwWords">
        <div
          v-for="w in words"
          :key="w.id"
          class="dwWord"
          draggable="true"
          :aria-disabled="locked || isUsed(w.id)"
          :style="{ opacity: locked || isUsed(w.id) ? 0.5 : 1 }"
          @dragstart="onDragStart(w.id)"
        >
          {{ w.text }}
        </div>
      </div>
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

<style scoped>
.dwText { line-height: 1.8; font-size: 16px; }

.dwBlank {
  display: inline-block;
  min-width: 86px;
  padding: 2px 6px;
  margin: 0 6px;
  border-radius: 10px;
  border: 1px dashed var(--color-border);
  background: #00000005;
  vertical-align: baseline;
}

.dwBlank.filled {
  border-style: solid;
  background: var(--color-surface);
}

.dwHint { color: rgba(0,0,0,0.55); }

.dwChip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  border-radius: 999px;
  padding: 2px 8px;
}

.dwX {
  border: 0;
  background: transparent;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 0 2px;
}

.dwWords { display:flex; flex-wrap:wrap; gap:10px; }

.dwWord {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  border-radius: 999px;
  padding: 8px 12px;
  cursor: grab;
  user-select: none;
}
</style>