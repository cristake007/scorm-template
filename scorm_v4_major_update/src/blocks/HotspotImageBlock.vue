<template>
  <div class="scorm-card">
    <div v-if="title" class="scorm-h2" style="margin-bottom:10px">{{ title }}</div>

    <div ref="wrapEl" class="hotspotWrap">
      <img class="hotspotImg" :src="src" :alt="alt || ''" />

      <button
        v-for="hs in hotspots"
        :key="hs.id"
        class="hotspot"
        type="button"
        :style="spotStyle(hs)"
        :aria-label="hs.label || 'Hotspot'"
        @click="onHotspotClick(hs, $event)"
        @mouseenter="onEnter(hs)"
        @mouseleave="onLeave(hs)"
      >
        <span class="hotspotDot" :class="{ done: clicked.has(hs.id) }"></span>

        <!-- Tooltip mode -->
        <div
          v-if="display === 'tooltip' && tooltipOpenFor(hs.id)"
          class="tooltip"
          role="tooltip"
        >
          <div v-if="hs.label" class="tooltipTitle">{{ hs.label }}</div>
          <div class="tooltipBody">{{ hs.text }}</div>
        </div>
      </button>
    </div>

    <!-- Panel mode -->
    <div v-if="display === 'panel' && active" class="hotspotPanel" style="margin-top:12px">
      <div class="scorm-h2" style="font-size:14px; margin-bottom:6px">
        {{ active.label || "Hotspot" }}
      </div>
      <div class="scorm-body" style="white-space:pre-wrap">{{ active.text }}</div>
    </div>

    <div v-if="requireAllClicks" class="scorm-muted" style="margin-top:10px">
      {{ clicked.size }} / {{ hotspots.length }} hotspots explored
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";

type Hotspot = {
  id: string;
  xPct: number;
  yPct: number;
  wPct?: number;
  hPct?: number;
  label?: string;
  text: string;
};

const props = defineProps<{
  type: "image.hotspots";
  id?: string;
  title?: string;

  src: string;
  alt?: string;

  hotspots: Hotspot[];

  requireAllClicks?: boolean;

  display?: "panel" | "tooltip"; // default "panel"
}>();

const emit = defineEmits<{
  (e: "viewed-ids", ids: string[]): void;
}>();

const display = computed(() => props.display ?? "panel");
const requireAllClicks = computed(() => props.requireAllClicks !== false);

// Progress tracking
const clicked = ref<Set<string>>(new Set());

// Panel mode state
const activeId = ref<string | null>(null);
const active = computed(() => props.hotspots.find((h) => h.id === activeId.value) ?? null);

// Tooltip mode state
const hoveredId = ref<string | null>(null); // desktop
const tappedOpenId = ref<string | null>(null); // touch

const wrapEl = ref<HTMLElement | null>(null);

// Simple touch detection (fine for our use)
const isTouch = ref(false);
if (typeof window !== "undefined") {
  isTouch.value = "ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0;
}

function spotStyle(h: Hotspot) {
  const w = h.wPct ?? 6;
  const hh = h.hPct ?? 6;
  return {
    left: `${h.xPct}%`,
    top: `${h.yPct}%`,
    width: `${w}%`,
    height: `${hh}%`,
    transform: "translate(-50%, -50%)",
  };
}

function markExplored(h: Hotspot) {
  if (clicked.value.has(h.id)) return;

  clicked.value.add(h.id);

  // track each hotspot click
  emit("viewed-ids", [`${props.id || "hotspots"}::${h.id}`]);

  // optionally emit "block complete" id once all hotspots clicked
  if (requireAllClicks.value && clicked.value.size === props.hotspots.length && props.id) {
    emit("viewed-ids", [props.id]);
  }
}

function tooltipOpenFor(hsId: string) {
  if (display.value !== "tooltip") return false;
  return isTouch.value ? tappedOpenId.value === hsId : hoveredId.value === hsId;
}

function onHotspotClick(h: Hotspot, e: MouseEvent) {
  // Always count as explored on click/tap
  markExplored(h);

  if (display.value === "panel") {
    activeId.value = h.id;
    return;
  }

  // Tooltip mode:
  // - desktop: click shouldn't "stick" tooltip (hover controls it)
  // - touch: tap toggles tooltip open/close
  if (display.value === "tooltip" && isTouch.value) {
    e.preventDefault();
    tappedOpenId.value = tappedOpenId.value === h.id ? null : h.id;
  }
}

function onEnter(h: Hotspot) {
  if (display.value !== "tooltip") return;
  if (isTouch.value) return;
  hoveredId.value = h.id;
}

function onLeave(h: Hotspot) {
  if (display.value !== "tooltip") return;
  if (isTouch.value) return;
  if (hoveredId.value === h.id) hoveredId.value = null;
}

// Close tooltip on outside tap (touch)
function onDocPointerDown(ev: PointerEvent) {
  if (!isTouch.value) return;
  if (display.value !== "tooltip") return;
  const el = wrapEl.value;
  if (!el) return;

  const target = ev.target as Node | null;
  if (!target) return;

  // If tap is outside the hotspot container, close
  if (!el.contains(target)) tappedOpenId.value = null;
}

if (typeof window !== "undefined") {
  document.addEventListener("pointerdown", onDocPointerDown, { passive: true });
}

onBeforeUnmount(() => {
  if (typeof window !== "undefined") {
    document.removeEventListener("pointerdown", onDocPointerDown as any);
  }
});
</script>

<style scoped>
.hotspotWrap {
  position: relative;
  width: 100%;
  border-radius: 0;
  overflow: hidden;
  border: 0;
}

.hotspotImg {
  display: block;
  width: 100%;
  height: auto;
}

.hotspot {
  position: absolute;
  background: transparent;
  border: 0;
  padding: 0;
  cursor: pointer;
}

.hotspotDot {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 14px;
  height: 14px;
  border-radius: 0;
  transform: translate(-50%, -50%);
  border: 0;
  background: rgba(255,255,255,0.85);
  box-shadow: 0 2px 10px rgba(0,0,0,0.15);
}

.hotspotDot.done {
  border-color: var(--color-primary, #1976d2);
  background: rgba(25, 118, 210, 0.15);
}

.hotspotPanel {
  border: 0;
  border-radius: 0;
  padding: 12px;
  background: #fff;
}

/* Tooltip */
.tooltip {
  position: absolute;
  left: 50%;
  top: -10px;
  transform: translate(-50%, -100%);
  min-width: 220px;
  max-width: 320px;
  padding: 10px 12px;
  border-radius: 0;
  border: 0;
  background: #fff;
  box-shadow: 0 10px 30px rgba(0,0,0,0.18);
  z-index: 10;
  pointer-events: none; /* hover stays on hotspot; touch uses outside listener */
}

.tooltipTitle {
  font-weight: 700;
  margin-bottom: 4px;
}

.tooltipBody {
  font-size: 14px;
  line-height: 1.35;
  white-space: pre-wrap;
}
</style>