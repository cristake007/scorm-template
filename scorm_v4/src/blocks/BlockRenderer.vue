<template>
  <component :is="Comp" v-bind="compProps" @quiz-submitted="forwardQuiz" />
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { AppContextKey } from "../engine/appContext";

import QuizMcqBlock from "./QuizMcqBlock.vue";
import VideoYouTubeBlock from "./VideoYouTubeBlock.vue";
import AudioBlock from "./AudioBlock.vue";
import QuizClozeSelectBlock from "./QuizClozeSelectBlock.vue";
import QuizMatchBlock from "./QuizMatchBlock.vue";
// import other blocks you have...
// import TextBlock from "./TextBlock.vue"; etc.

const props = defineProps<{ block: any }>();

const emit = defineEmits<{
  (e: "quiz-submitted", payload: {
    quizId: string;
    raw: number;
    max: number;
    passScore: number;
    responses: Record<string, string | string[]>;
  }): void;
}>();

const ctx = inject(AppContextKey);

// Component chooser (extend as you add blocks)
const Comp = computed(() => {
  switch (props.block.type) {
    case "quiz.mcq":
      return QuizMcqBlock;
    case "quiz.clozeSelect":
      return QuizClozeSelectBlock;
    case "quiz.match":
      return QuizMatchBlock;
    case "audio":
      return AudioBlock;
    case "video.youtube":
      return VideoYouTubeBlock;
    default:
      return "div";
  }
});

const compProps = computed(() => {
  if (typeof props.block.type === "string" && props.block.type.startsWith("quiz.")) {
    const quizId = props.block.quizId as string;
    const existing = ctx?.state.scores?.[quizId] ?? null;
    return { ...props.block, existing };
  }
  return props.block;
});

function forwardQuiz(payload: {
  quizId: string;
  raw: number;
  max: number;
  passScore: number;
  responses: Record<string, string | string[]>;
}) {
  emit("quiz-submitted", payload);
}
</script>