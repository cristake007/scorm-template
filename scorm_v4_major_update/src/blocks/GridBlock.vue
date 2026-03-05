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
import { onBeforeUnmount, onMounted, ref } from "vue";
import BlockRenderer from "./BlockRenderer.vue";

type Breakpoint = "sm" | "md" | "lg" | "xl";
type SpanSpec = number | Partial<Record<Breakpoint, number>>;

type Align = "start" | "center" | "end" | "stretch";
type Justify = "start" | "center" | "end" | "stretch";

type GridItem = {
  id?: string;

  // legacy
  span?: number;

  // new
  colSpan?: SpanSpec;
  rowSpan?: SpanSpec;
  align?: Align;
  justify?: Justify;

  blocks: any[];
};

const props = defineProps<{
  type: "layout.grid";
  id?: string;
  requiredView?: boolean;

  columns?: { sm?: number; md?: number; lg?: number; xl?: number };
  gap?: "sm" | "md" | "lg";

  /** Optional row sizing (e.g. "auto", "minmax(120px, auto)") */
  autoRows?: string;

  items: GridItem[];
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

// Match your CSS media breakpoints:
// md: 960, lg: 1280, xl: 1920
function currentBpForWidth(w: number): Breakpoint {
  if (w >= 1920) return "xl";
  if (w >= 1280) return "lg";
  if (w >= 960) return "md";
  return "sm";
}

const width = ref(typeof window !== "undefined" ? window.innerWidth : 1024);
const bp = ref<Breakpoint>(currentBpForWidth(width.value));

function onResize() {
  width.value = window.innerWidth;
  bp.value = currentBpForWidth(width.value);
}

onMounted(() => window.addEventListener("resize", onResize, { passive: true }));
onBeforeUnmount(() => window.removeEventListener("resize", onResize));

function resolveSpan(span: SpanSpec | undefined, fallback: number): number {
  if (typeof span === "number") return Math.max(1, Math.floor(span));
  if (span && typeof span === "object") {
    const v = span[bp.value] ?? span.lg ?? span.md ?? span.sm ?? span.xl;
    if (typeof v === "number") return Math.max(1, Math.floor(v));
  }
  return Math.max(1, Math.floor(fallback));
}

const gridVars = {
  "--gap": gapPx(props.gap),
  "--cols-sm": String(props.columns?.sm ?? 1),
  "--cols-md": String(props.columns?.md ?? props.columns?.sm ?? 1),
  "--cols-lg": String(props.columns?.lg ?? props.columns?.md ?? props.columns?.sm ?? 1),
  "--cols-xl": String(props.columns?.xl ?? props.columns?.lg ?? props.columns?.md ?? props.columns?.sm ?? 1),
  "--auto-rows": props.autoRows ?? "auto"
} as Record<string, string>;

function cellStyle(it: GridItem) {
  // Legacy support: if only span exists, treat as colSpan number
  const col = resolveSpan(it.colSpan ?? it.span, 1);
  const row = resolveSpan(it.rowSpan, 1);

  const alignSelf = it.align ?? "stretch";
  const justifySelf = it.justify ?? "stretch";

  return {
    gridColumn: `span ${col}`,
    gridRow: row > 1 ? `span ${row}` : undefined,
    alignSelf,
    justifySelf
  };
}
</script>