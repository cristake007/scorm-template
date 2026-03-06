<template>
  <div ref="rootEl" class="scorm-card kpiMetrics">
    <div v-if="title" class="scorm-h2 kpiMetrics__title">{{ title }}</div>

    <div class="kpiMetrics__grid">
      <article v-for="(item, idx) in items" :key="item.id || idx" class="kpiMetrics__card">
        <div class="kpiMetrics__value">{{ format(item, displayValues[idx] ?? 0) }}</div>
        <div class="kpiMetrics__label">{{ item.label }}</div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

type KpiItem = {
  id?: string;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
};

const props = defineProps<{
  id?: string;
  type: "kpi.metrics";
  title?: string;
  durationMs?: number;
  items: KpiItem[];
}>();

const emit = defineEmits<{ (e: "viewed-ids", ids: string[]): void }>();

const displayValues = ref<number[]>([]);
const rootEl = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;
let raf = 0;
let started = false;

function format(item: KpiItem, n: number) {
  const d = item.decimals ?? 0;
  return `${item.prefix ?? ""}${n.toFixed(d)}${item.suffix ?? ""}`;
}

function startAnimation() {
  if (started) return;
  started = true;

  const duration = Math.max(300, props.durationMs ?? 1200);
  const start = performance.now();
  let lastPaint = 0;

  const tick = (t: number) => {
    const p = Math.min(1, (t - start) / duration);

    // cap updates to ~30fps to reduce reactive churn while scrolling
    if (t - lastPaint >= 33 || p >= 1) {
      displayValues.value = props.items.map((it) => it.value * p);
      lastPaint = t;
    }

    if (p < 1) {
      raf = requestAnimationFrame(tick);
      return;
    }

    raf = 0;
    if (props.id) emit("viewed-ids", [props.id]);
  };

  raf = requestAnimationFrame(tick);
}

onMounted(() => {
  displayValues.value = props.items.map(() => 0);

  if (!rootEl.value) {
    startAnimation();
    return;
  }

  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        startAnimation();
        observer?.disconnect();
        observer = null;
      }
    },
    { threshold: 0.25 }
  );

  observer.observe(rootEl.value);
});

onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf);
  observer?.disconnect();
  observer = null;
});
</script>
