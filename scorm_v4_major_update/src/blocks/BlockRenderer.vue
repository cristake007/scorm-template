<template>
  <component
    :is="Comp"
    v-bind="compProps"
    @quiz-submitted="forwardQuiz"
    @viewed-ids="forwardViewed"
  />
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { AppContextKey } from "../engine/appContext";

import QuizMcqBlock from "./QuizMcqBlock.vue";
import VideoYouTubeBlock from "./VideoYouTubeBlock.vue";
import AudioBlock from "./AudioBlock.vue";
import QuizClozeSelectBlock from "./QuizClozeSelectBlock.vue";
import QuizMatchBlock from "./QuizMatchBlock.vue";
import AccordionBlock from "./AccordionBlock.vue";
import FlipCardBlock from "./FlipCardBlock.vue";
import ScrollSentinelBlock from "./ScrollSentinelBlock.vue";
import TextBlock from "./TextBlock.vue";
import ImageBlock from "./ImageBlock.vue";
import HotspotImageBlock from "./HotspotImageBlock.vue";
import QuizDragWordsBlock from "./QuizDragWordsBlock.vue";
import SectionBlock from "./SectionBlock.vue";
import IconListBlock from "./IconListBlock.vue";
import GridBlock from "./GridBlock.vue";

const props = defineProps<{ block: any }>();

const emit = defineEmits<{
  (e: "quiz-submitted", payload: {
    quizId: string;
    raw: number;
    max: number;
    passScore: number;
    responses: Record<string, string | string[]>;
  }): void;
  (e: "viewed-ids", ids: string[]): void;
}>();

const ctx = inject(AppContextKey);

// Component chooser
const Comp = computed(() => {
  switch (props.block.type) {
    case "quiz.mcq":
      return QuizMcqBlock;
    case "quiz.clozeSelect":
      return QuizClozeSelectBlock;
    case "quiz.match":
      return QuizMatchBlock;
    case "quiz.dragWords":
      return QuizDragWordsBlock;

    case "audio":
      return AudioBlock;
    case "video.youtube":
      return VideoYouTubeBlock;

    case "accordion":
      return AccordionBlock;
    case "flipcard":
      return FlipCardBlock;
    case "scroll.sentinel":
      return ScrollSentinelBlock;

    case "text":
      return TextBlock;
    case "image":
      return ImageBlock;
    case "image.hotspots":
      return HotspotImageBlock;

    case "section":
      return SectionBlock;
    case "iconList":
      return IconListBlock;

    case "layout.grid":
      return GridBlock;

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

function forwardViewed(ids: string[]) {
  emit("viewed-ids", ids);
}
</script>