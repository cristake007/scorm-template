<template>
  <div class="scorm-card kpiMetrics">
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
import { onMounted, ref } from "vue";

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

function format(item: KpiItem, n: number) {
  const d = item.decimals ?? 0;
  return `${item.prefix ?? ""}${n.toFixed(d)}${item.suffix ?? ""}`;
}

onMounted(() => {
  const duration = Math.max(300, props.durationMs ?? 1200);
  const start = performance.now();

  const tick = (t: number) => {
    const p = Math.min(1, (t - start) / duration);
    displayValues.value = props.items.map((it) => it.value * p);

    if (p < 1) {
      requestAnimationFrame(tick);
      return;
    }

    if (props.id) emit("viewed-ids", [props.id]);
  };

  requestAnimationFrame(tick);
});
</script>
