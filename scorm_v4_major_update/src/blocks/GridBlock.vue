<template>
  <div class="scorm-grid" :style="gridVars">
    <div
      v-for="(it, i) in items"
      :key="it.id ?? i"
      class="scorm-grid__cell"
      :style="cellStyle(it)"
    >
      <!-- Keep the SAME wrapper your observer expects -->
      <div
        v-for="child in it.blocks"
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

const props = defineProps<{
  type: "layout.grid";
  id?: string;
  requiredView?: boolean;

  columns?: { sm?: number; md?: number; lg?: number; xl?: number };
  gap?: "sm" | "md" | "lg";
  items: Array<{ id?: string; span?: number; blocks: any[] }>;
}>();

defineEmits<{
  (e: "quiz-submitted", payload: any): void;
  (e: "viewed-ids", ids: string[]): void;
}>();

function gapPx(g?: string) {
  if (g === "sm") return "10px";
  if (g === "lg") return "18px";
  return "14px"; // md default
}

const gridVars = {
  "--gap": gapPx(props.gap),
  "--cols-sm": String(props.columns?.sm ?? 1),
  "--cols-md": String(props.columns?.md ?? props.columns?.sm ?? 1),
  "--cols-lg": String(props.columns?.lg ?? props.columns?.md ?? props.columns?.sm ?? 1),
  "--cols-xl": String(props.columns?.xl ?? props.columns?.lg ?? props.columns?.md ?? props.columns?.sm ?? 1),
} as any;

function cellStyle(it: { span?: number }) {
  const span = Math.max(1, Number(it.span ?? 1) || 1);
  return { gridColumn: `span ${span}` };
}
</script>

<style scoped>
.scorm-grid {
  display: grid;
  gap: var(--gap);
  grid-template-columns: repeat(var(--cols-sm), minmax(0, 1fr));
}

@media (min-width: 960px) {
  .scorm-grid {
    grid-template-columns: repeat(var(--cols-md), minmax(0, 1fr));
  }
}
@media (min-width: 1280px) {
  .scorm-grid {
    grid-template-columns: repeat(var(--cols-lg), minmax(0, 1fr));
  }
}
@media (min-width: 1920px) {
  .scorm-grid {
    grid-template-columns: repeat(var(--cols-xl), minmax(0, 1fr));
  }
}

.scorm-grid__cell {
  min-width: 0;
}
</style>