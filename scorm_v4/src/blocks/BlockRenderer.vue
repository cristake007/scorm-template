<template>
  <component
    :is="component"
    v-bind="block"
    @quiz-submitted="(payload) => emit('quiz-submitted', payload)"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Block } from "../engine/course/courseLoader";

import VideoYouTubeBlock from "./VideoYouTubeBlock.vue";
import QuizMcqBlock from "./QuizMcqBlock.vue";

const props = defineProps<{ block: Block }>();

const emit = defineEmits<{
  (e: "quiz-submitted", payload: { quizId: string; raw: number; max: number; passScore: number }): void;
}>();

const component = computed(() => {
  switch (props.block.type) {
    case "video.youtube":
      return VideoYouTubeBlock;
    case "quiz.mcq":
      return QuizMcqBlock;
    case "text":
    case "image":
      // We’ll add these next (or you can temporarily render as plain)
      return {
        props: ["type", "text", "src", "alt", "variant"],
        template:
          '<div class="scorm-card"><div v-if="type===\'text\'"><div :class="variantClass">{{text}}</div></div><div v-else><img :src="src" :alt="alt||\'\'" style="max-width:100%;height:auto;border-radius:12px"/></div></div>',
        computed: {
          variantClass() {
            return this.variant === "h1" ? "scorm-h1" : this.variant === "muted" ? "scorm-muted" : "";
          }
        }
      } as any;
    default:
      return {
        props: ["type"],
        template: '<div class="scorm-card"><div class="scorm-muted">Unsupported block: {{ type }}</div></div>'
      } as any;
  }
});
</script>