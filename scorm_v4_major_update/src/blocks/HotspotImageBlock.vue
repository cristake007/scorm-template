<template>
  <div class="scorm-card">
    <div v-if="title" class="scorm-h2 hotspotBlock__title">{{ title }}</div>

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
    <div v-if="display === 'panel' && active" class="hotspotPanel">
      <div class="scorm-h2 hotspotPanel__title">
        {{ active.label || "Hotspot" }}
      </div>
      <div class="scorm-body scorm-prewrap">{{ active.text }}</div>
    </div>

    <div v-if="requireAllClicks" class="scorm-muted hotspotBlock__status">
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

