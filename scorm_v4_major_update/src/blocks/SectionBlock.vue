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
        v-for="(child, idx) in blocks"
        :key="child.id"
        class="scorm-block"
        :id="sectionChildBlockId(child, idx)"
        :class="sectionChildBlockClass(child)"
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

function toCssId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function sectionChildBlockId(block: any, idx: number) {
  const blockId = block?.id ? toCssId(String(block.id)) : `index-${idx + 1}`;
  return `section-block-${blockId}`;
}

function sectionChildBlockClass(block: any) {
  return [`block-type-${toCssId(String(block?.type || "unknown"))}`];
}

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
