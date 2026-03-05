<!-- src/blocks/SectionBlock.vue -->
<template>
  <div
    class="scorm-section"
    :class="[
      variant === 'plain' ? 'scorm-section--plain' : 'scorm-section--card',
      padding ? `scorm-section--pad-${padding}` : 'scorm-section--pad-md'
    ]"
  >
    <div v-if="title" class="scorm-section__title">{{ title }}</div>

    <div class="scorm-section__body">
      <div
        v-for="child in blocks"
        :key="child.id"
        class="scorm-block"
        :data-block-id="child.id"
      >
        <BlockRenderer
          :block="child"
          @quiz-submitted="$emit('quiz-submitted', $event)"
          @viewed-ids="$emit('viewed-ids', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import BlockRenderer from "./BlockRenderer.vue";

defineProps<{
  type: "section";
  id?: string;
  requiredView?: boolean;

  title?: string;
  variant?: "card" | "plain";
  padding?: "sm" | "md" | "lg";

  blocks: any[]; // keep any to avoid TS type-resolve issues
}>();

defineEmits<{
  (e: "quiz-submitted", payload: any): void;
  (e: "viewed-ids", ids: string[]): void;
}>();
</script>

<style scoped>
.scorm-section--card {
  border: 1px solid rgba(0,0,0,.08);
  border-radius: 16px;
  background: #fff;
}
.scorm-section--plain {
  border: 0;
  background: transparent;
}
.scorm-section--pad-sm { padding: 10px; }
.scorm-section--pad-md { padding: 14px; }
.scorm-section--pad-lg { padding: 18px; }

.scorm-section__title {
  font-weight: 700;
  font-size: 16px;
  margin-bottom: 10px;
}
.scorm-section__body {
  display: grid;
  gap: 12px;
}
</style>