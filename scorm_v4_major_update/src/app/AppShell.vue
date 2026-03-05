<template>
  <v-app>
    <a class="skipLink" href="#mainContent">Skip to course content</a>
    <v-layout class="appLayout" :class="{ drawerClosed: !drawerOpen }">
      <v-app-bar color="surface" :elevation="2" density="comfortable" :height="80">
        <template #prepend>
          <v-app-bar-nav-icon icon="mdi-menu" aria-label="Toggle navigation" @click="drawerOpen = !drawerOpen" />
        </template>

        <v-app-bar-title class="text-no-wrap">
          <div class="appbarTitleWrap">
            <div class="appbarTitle">{{ courseTitle }}</div>
            <div class="appbarSubtitle">{{ courseVersion }}</div>
          </div>
        </v-app-bar-title>

        <v-spacer />
        <v-img v-if="logoUrl" :src="logoUrl" max-height="40" max-width="140" contain class="mr-2" />
        <v-btn class="ml-2" variant="text" prepend-icon="mdi-help-circle-outline" @click="openTour">How to navigate</v-btn>
      </v-app-bar>

      <v-navigation-drawer
        ref="navDrawerEl"
        v-model="drawerOpen"
        :width="drawerWidth"
        :temporary="!mdAndUp"
        :permanent="mdAndUp"
        class="navDrawer"
        :class="{ isResizing: resizing }"
      >
        <v-btn
          :to="overviewRoute"
          variant="text"
          block
          rounded="0"
          :ripple="false"
          class="navRow navRow--root"
          :class="{ 'navRow--active': route.path === overviewRoute }"
        >
          <div class="navRow__inner">
            <div class="navRow__left">
              <span class="navRow__title navRow__title--bold">Overview</span>
            </div>
          </div>
        </v-btn>

        <div class="navDivider"></div>

        <template v-for="lesson in nav" :key="lesson.lessonId">
          <v-btn variant="text" block rounded="0" :ripple="false" class="navRow navRow--root" @click="toggleLesson(lesson.lessonId)">
            <div class="navRow__inner">
              <div class="navRow__left">
                <span class="navRow__title">{{ lesson.title }}</span>
              </div>
              <div class="navRow__right navRow__right--compact">
                <v-progress-circular :model-value="lesson.progressPercent" size="18" width="2" color="primary" />
                <v-icon :icon="isLessonOpen(lesson.lessonId) ? 'mdi-chevron-up' : 'mdi-chevron-down'" :color="isLessonOpen(lesson.lessonId) ? 'primary' : 'grey'" />
              </div>
            </div>
          </v-btn>

          <div class="navDivider"></div>

          <div v-show="isLessonOpen(lesson.lessonId)">
            <v-btn
              v-for="(chapter, idx) in lesson.chapters"
              :key="chapter.route"
              :to="chapter.route"
              variant="text"
              block
              rounded="0"
              :ripple="false"
              class="navRow navRow--child"
              :class="{ 'navRow--active': route.path === chapter.route }"
            >
              <div class="navRow__inner">
                <div class="navRow__left">
                  <span class="navRow__index">{{ idx + 1 }}</span>
                  <div class="navRow__text">
                    <div class="navRow__title" :class="{ 'navRow__title--bold': route.path === chapter.route }">
                      {{ chapter.title }}
                    </div>
                  </div>
                </div>

                <div class="navRow__right">
                  <v-icon icon="mdi-check-circle-outline" :color="chapter.completed ? 'primary' : 'grey-lighten-1'" />
                </div>
              </div>
            </v-btn>

            <div class="navDivider"></div>
          </div>
        </template>

        <div v-if="lockedMessage" class="navLockedMsg">{{ lockedMessage }}</div>

        <div
          v-if="mdAndUp"
          ref="resizerEl"
          class="drawerResizer"
          role="separator"
          aria-label="Resize navigation"
          @pointerdown="startResize"
        />
      </v-navigation-drawer>

      <v-main id="mainContent" ref="mainContentEl" tabindex="-1">
        <div v-if="showChapterPager" ref="pagerEl" class="chapterPager" aria-label="Chapter navigation">
          <v-btn v-if="prevRoute" icon="mdi-chevron-left" color="primary" class="chapterPager__btn" @click="goToChapter(prevRoute)" />
          <v-btn v-if="nextRoute" icon="mdi-chevron-right" color="primary" class="chapterPager__btn" @click="goToChapter(nextRoute)" />
        </div>
        <router-view />
      </v-main>
    </v-layout>

    <v-dialog v-model="tourDialog" max-width="760" persistent>
      <v-card class="tourDialog">
        <v-card-title>{{ activeTourStep?.title || "Course tour" }}</v-card-title>
        <v-card-text>
          <p class="tourDialog__text">{{ activeTourStep?.description }}</p>
          <div class="tourDialog__progress">Step {{ tourStepIndex + 1 }} of {{ tourSteps.length }}</div>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" @click="showTourOnNextLaunch">Show on next launch</v-btn>
          <v-spacer />
          <v-btn variant="text" @click="closeTour">Skip</v-btn>
          <v-btn variant="text" :disabled="tourStepIndex === 0" @click="goToTourStep(tourStepIndex - 1)">Back</v-btn>
          <v-btn color="primary" @click="nextTourStep">{{ tourStepIndex === tourSteps.length - 1 ? "Done" : "Next" }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <div v-if="tourDialog && spotlightStyle" class="tourSpotlight" :style="spotlightStyle" aria-hidden="true" />
  </v-app>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useDisplay } from "vuetify";
import { useRoute, useRouter } from "vue-router";

import type { NavLesson } from "../engine/navigation/navModel";
import { RuntimeStoreKey } from "../core/runtime/runtimeStore";

defineProps<{
  courseTitle: string;
  courseVersion: string;
  nav: NavLesson[];
  lockedMessage: string;
  logoUrl?: string;
}>();

type TourStep = {
  title: string;
  description: string;
  selector: string;
  forceScrollBottom?: boolean;
};

const runtime = inject(RuntimeStoreKey);
if (!runtime) throw new Error("RuntimeStore not provided");

const { mdAndUp } = useDisplay();
const route = useRoute();
const router = useRouter();
const drawerOpen = ref(mdAndUp.value);

watch(mdAndUp, (isDesktop) => {
  drawerOpen.value = isDesktop;
});

watch(
  () => route.fullPath,
  () => {
    window.setTimeout(() => {
      updateBottomState();
      updateSpotlight();
    }, 0);
  }
);

const overviewRoute = computed(() => runtime.course.system?.fallbackRoute || runtime.course.system?.routes?.[0]?.route || "/");
const chapterRouteOrder = computed(() => runtime.course.lessons.flatMap((lesson) => lesson.chapters.map((chapter) => chapter.route)));

const currentChapterIndex = computed(() => chapterRouteOrder.value.findIndex((r) => r === route.path));
const prevRoute = computed(() => (currentChapterIndex.value > 0 ? chapterRouteOrder.value[currentChapterIndex.value - 1] : ""));
const nextRoute = computed(() =>
  currentChapterIndex.value >= 0 && currentChapterIndex.value < chapterRouteOrder.value.length - 1
    ? chapterRouteOrder.value[currentChapterIndex.value + 1]
    : ""
);
const showChapterPager = computed(() => atBottom.value && (!!prevRoute.value || !!nextRoute.value));

const MIN_W = 280;
const MAX_W = () => Math.min(520, window.innerWidth - 80);
const drawerWidth = ref(360);
const openLessons = ref(new Set<string>());
const resizing = ref(false);
const resizerEl = ref<HTMLElement | null>(null);
const mainContentEl = ref<any>(null);
const navDrawerEl = ref<any>(null);
const pagerEl = ref<any>(null);
const atBottom = ref(false);

const tourDialog = ref(false);
const tourStepIndex = ref(0);
const spotlightStyle = ref<Record<string, string> | null>(null);
const tourSteps: TourStep[] = [
  {
    title: "Open lessons from the drawer",
    description: "Start here. Expand a lesson to reveal chapters, then open any chapter from the left navigation.",
    selector: ".v-navigation-drawer .navRow--root"
  },
  {
    title: "Jump directly to chapters",
    description: "Chapter rows show completion status and let you jump around quickly without losing progress.",
    selector: ".v-navigation-drawer .navRow--child"
  },
  {
    title: "Use quick previous/next controls",
    description: "When you reach the bottom of a chapter, floating back/next buttons appear for fast navigation.",
    selector: ".chapterPager",
    forceScrollBottom: true
  },
  {
    title: "Finish at the end",
    description: "The Finish course button appears on the final chapter and only unlocks once all required lessons are complete.",
    selector: ".finishCourseWrap"
  }
];

const activeTourStep = computed(() => tourSteps[tourStepIndex.value] ?? null);

let onMove: ((e: PointerEvent) => void) | null = null;
let onUp: ((e: PointerEvent) => void) | null = null;

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const isLessonOpen = (id: string) => openLessons.value.has(id);

function toggleLesson(id: string) {
  const next = new Set(openLessons.value);
  next.has(id) ? next.delete(id) : next.add(id);
  openLessons.value = next;
}

function startResize(e: PointerEvent) {
  const el = resizerEl.value;
  if (!el) return;

  resizing.value = true;
  document.documentElement.classList.add("no-select");
  el.setPointerCapture(e.pointerId);

  let raf = 0;
  let latestX = e.clientX;

  onMove = (ev: PointerEvent) => {
    latestX = ev.clientX;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (!resizing.value) return;
      drawerWidth.value = clamp(latestX, MIN_W, MAX_W());
    });
  };

  onUp = () => {
    resizing.value = false;
    document.documentElement.classList.remove("no-select");
    if (raf) cancelAnimationFrame(raf);
    if (onMove) window.removeEventListener("pointermove", onMove);
    if (onUp) window.removeEventListener("pointerup", onUp);
    onMove = null;
    onUp = null;
  };

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerup", onUp, { once: true });

  e.preventDefault();
}

const tourStorageKey = `tour-seen:${runtime.course.course.id}:v${runtime.course.course.version}`;

function showTourOnNextLaunch() {
  try {
    window.localStorage.removeItem(tourStorageKey);
  } catch {
    // ignore
  }
  closeTour();
}

function dismissTour() {
  try {
    window.localStorage.setItem(tourStorageKey, "1");
  } catch {
    // ignore
  }
}

function getMainScroller(): HTMLElement | null {
  const raw = mainContentEl.value;
  if (!raw) return null;
  if (raw instanceof HTMLElement) return raw;
  return (raw.$el as HTMLElement) ?? null;
}

function updateBottomState() {
  const el = getMainScroller();
  if (!el) {
    atBottom.value = false;
    return;
  }

  atBottom.value = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
}

function resolveSpotlightElement(step: TourStep): HTMLElement | null {
  return document.querySelector<HTMLElement>(step.selector);
}

function updateSpotlight() {
  if (!tourDialog.value || !activeTourStep.value) {
    spotlightStyle.value = null;
    return;
  }

  const targetEl = resolveSpotlightElement(activeTourStep.value);
  if (!targetEl) {
    spotlightStyle.value = null;
    return;
  }

  const rect = targetEl.getBoundingClientRect();
  spotlightStyle.value = {
    top: `${Math.max(8, rect.top - 8)}px`,
    left: `${Math.max(8, rect.left - 8)}px`,
    width: `${Math.max(40, rect.width + 16)}px`,
    height: `${Math.max(40, rect.height + 16)}px`
  };
}

function ensureStepVisible(step: TourStep) {
  if (!step.forceScrollBottom) return;
  const scroller = getMainScroller();
  if (!scroller) return;

  scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
  window.setTimeout(updateBottomState, 120);
}

function goToTourStep(idx: number) {
  if (idx < 0 || idx > tourSteps.length - 1) return;
  tourStepIndex.value = idx;
  ensureStepVisible(tourSteps[idx]);
  window.setTimeout(updateSpotlight, 200);
}

function nextTourStep() {
  if (tourStepIndex.value >= tourSteps.length - 1) {
    dismissTour();
    closeTour();
    return;
  }

  goToTourStep(tourStepIndex.value + 1);
}

function openTour() {
  tourDialog.value = true;
  goToTourStep(0);
}

function closeTour() {
  tourDialog.value = false;
  spotlightStyle.value = null;
}

function goToChapter(targetRoute: string) {
  if (!targetRoute) return;
  router.push(targetRoute);
  const el = getMainScroller();
  if (el) el.scrollTo({ top: 0, behavior: "smooth" });
}

watch([tourDialog, tourStepIndex, showChapterPager], () => {
  window.setTimeout(updateSpotlight, 0);
});


watch(tourDialog, (open) => {
  if (open) {
    window.addEventListener("scroll", updateSpotlight, { passive: true });
    window.setTimeout(updateSpotlight, 0);
    return;
  }

  window.removeEventListener("scroll", updateSpotlight);
});

onMounted(() => {
  const el = getMainScroller();
  if (el) el.addEventListener("scroll", updateBottomState, { passive: true });

  window.addEventListener("resize", updateSpotlight, { passive: true });

  updateBottomState();

  try {
    if (!window.localStorage.getItem(tourStorageKey)) {
      openTour();
    }
  } catch {
    // ignore
  }
});

onBeforeUnmount(() => {
  const el = getMainScroller();
  if (el) el.removeEventListener("scroll", updateBottomState);

  window.removeEventListener("resize", updateSpotlight);
  window.removeEventListener("scroll", updateSpotlight);

  document.documentElement.classList.remove("no-select");
  if (onMove) window.removeEventListener("pointermove", onMove);
  if (onUp) window.removeEventListener("pointerup", onUp);
});
</script>
