<template>
  <v-app id="app-shell">
    <v-layout class="appLayout" :class="{ drawerClosed: !drawerOpen }">
      <v-app-bar id="app-shell-topbar" color="surface" :elevation="2" density="comfortable" :height="70">
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
      </v-app-bar>
      <div class="appBarScrollTrack" aria-hidden="true">
        <div class="appBarScrollValue" :style="{ transform: `scaleX(${scrollProgress})` }" />
      </div>

      <v-navigation-drawer
        ref="navDrawerEl"
        v-model="drawerOpen"
        :width="drawerWidth"
        :temporary="!mdAndUp"
        :permanent="mdAndUp"
        class="navDrawer" id="app-shell-nav-drawer"
        :class="{ isResizing: resizing }"
      >
        <div class="navDrawer__header" id="app-shell-nav-header">
          <div class="navDrawer__courseTitle">{{ courseTitle }}</div>
        </div>

        <v-btn
          :to="overviewRoute"
          variant="text"
          block
          rounded="0"
          :ripple="false"
          class="navRow navRow--root"
          id="nav-item-overview"
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
          <v-btn variant="text" block rounded="0" :ripple="false" class="navRow navRow--root" :id="navLessonToggleId(lesson.lessonId)" @click="toggleLesson(lesson.lessonId)">
            <div class="navRow__inner">
              <div class="navRow__left">
                <span class="navRow__title">{{ lesson.title }}</span>
              </div>
              <div class="navRow__right navRow__right--compact">
                <v-icon :icon="isLessonOpen(lesson.lessonId) ? 'mdi-chevron-up' : 'mdi-chevron-down'" :color="isLessonOpen(lesson.lessonId) ? 'primary' : 'grey'" />
              </div>
            </div>
          </v-btn>

          <div class="navDivider"></div>

          <transition name="lesson-expand">
            <div v-if="isLessonOpen(lesson.lessonId)" class="navChapterGroup">
              <v-btn
                v-for="chapter in lesson.chapters"
                :key="chapter.route"
                :to="chapter.route"
                variant="text"
                block
                rounded="0"
                :ripple="false"
                class="navRow navRow--child"
                :id="navChapterId(chapter.route)"
                :class="{ 'navRow--active': route.path === chapter.route }"
              >
                <div class="navRow__inner">
                  <div class="navRow__left">
                    <span class="navRow__index">{{ chapterDisplayIndex(chapter.route) }}</span>
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
          </transition>
        </template>

        <div v-if="lockedMessage" class="navLockedMsg" id="app-shell-nav-locked-message">{{ lockedMessage }}</div>

        <div
          v-if="mdAndUp"
          ref="resizerEl"
          class="drawerResizer" id="app-shell-nav-resizer"
          role="separator"
          aria-label="Resize navigation"
          @pointerdown="startResize"
        />
      </v-navigation-drawer>

      <v-main id="mainContent" class="appShellMain" ref="mainContentEl" tabindex="-1">
        <div v-if="showChapterPager" ref="pagerEl" class="chapterPager" id="app-shell-chapter-pager" aria-label="Chapter navigation">
          <v-btn v-if="prevRoute" icon="mdi-chevron-left" color="primary" class="chapterPager__btn" @click="goToChapter(prevRoute)" />
          <v-btn v-if="nextRoute" icon="mdi-chevron-right" color="primary" class="chapterPager__btn" @click="goToChapter(nextRoute)" />
        </div>
        <router-view />
      </v-main>
    </v-layout>

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
    for (const lesson of runtime.course.lessons) {
      if (lesson.chapters.some((chapter) => chapter.route === route.path)) {
        openLessons.value = new Set([...openLessons.value, lesson.id]);
      }
    }

    window.setTimeout(() => {
      updateBottomState();
    }, 0);
  }
);

const overviewRoute = computed(() => runtime.course.system?.fallbackRoute || runtime.course.system?.routes?.[0]?.route || "/");
const chapterRouteOrder = computed(() => runtime.course.lessons.flatMap((lesson) => lesson.chapters.map((chapter) => chapter.route)));
const chapterIndexByRoute = computed(() => {
  const indexMap = new Map<string, number>();
  chapterRouteOrder.value.forEach((chapterRoute, idx) => {
    indexMap.set(chapterRoute, idx + 1);
  });
  return indexMap;
});

const currentChapterIndex = computed(() => chapterRouteOrder.value.findIndex((r) => r === route.path));
const prevRoute = computed(() => (currentChapterIndex.value > 0 ? chapterRouteOrder.value[currentChapterIndex.value - 1] : ""));
const nextRoute = computed(() =>
  currentChapterIndex.value >= 0 && currentChapterIndex.value < chapterRouteOrder.value.length - 1
    ? chapterRouteOrder.value[currentChapterIndex.value + 1]
    : ""
);
const showChapterPager = computed(() => atBottom.value && (!!prevRoute.value || !!nextRoute.value));

const MIN_W = 320;
const MAX_W = () => Math.min(520, window.innerWidth - 80);
const drawerWidth = ref(360);
const openLessons = ref(new Set<string>());
const resizing = ref(false);
const resizerEl = ref<HTMLElement | null>(null);
const mainContentEl = ref<any>(null);
const atBottom = ref(false);
const scrollProgress = ref(0);

let onMove: ((e: PointerEvent) => void) | null = null;
let onUp: ((e: PointerEvent) => void) | null = null;
let scrollRaf = 0;

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const isLessonOpen = (id: string) => openLessons.value.has(id);
const chapterDisplayIndex = (chapterRoute: string) => chapterIndexByRoute.value.get(chapterRoute) ?? 0;

function toCssId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function navLessonToggleId(lessonId: string) {
  return `nav-lesson-toggle-${toCssId(lessonId)}`;
}

function navChapterId(chapterRoute: string) {
  return `nav-chapter-${toCssId(chapterRoute)}`;
}

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

function getMainScroller(): HTMLElement | null {
  const raw = mainContentEl.value;
  if (!raw) return null;
  if (raw instanceof HTMLElement) return raw;
  return (raw.$el as HTMLElement) ?? null;
}

function updateBottomState() {
  scrollRaf = 0;
  const el = getMainScroller();
  if (!el) {
    atBottom.value = false;
    scrollProgress.value = 0;
    return;
  }
  const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
  const currentScroll = Math.max(0, Math.min(el.scrollTop, maxScroll));
  atBottom.value = currentScroll + el.clientHeight >= el.scrollHeight - 4;
  scrollProgress.value = maxScroll > 0 ? currentScroll / maxScroll : 0;
}

function queueBottomStateUpdate() {
  if (scrollRaf) return;
  scrollRaf = window.requestAnimationFrame(updateBottomState);
}

function lessonHasCompletedChapter(lessonId: string): boolean {
  return runtime.state.completedChapters.some((chapterKey) => chapterKey.startsWith(`${lessonId}/`));
}

function restoreOpenLessons() {
  const restored = new Set<string>();

  const suspendedRoute = runtime.state.lastRoute?.split("?")[0] || "";

  for (const lesson of runtime.course.lessons) {
    const includesCurrentRoute = lesson.chapters.some((chapter) => chapter.route === route.path);
    const includesSuspendedRoute = suspendedRoute && lesson.chapters.some((chapter) => chapter.route === suspendedRoute);
    if (lessonHasCompletedChapter(lesson.id) || includesCurrentRoute || includesSuspendedRoute) restored.add(lesson.id);
  }

  openLessons.value = restored;
}

function goToChapter(targetRoute: string) {
  if (!targetRoute) return;
  router.push(targetRoute);
  const el = getMainScroller();
  if (el) el.scrollTo({ top: 0 });
}

onMounted(() => {
  restoreOpenLessons();

  const el = getMainScroller();
  if (el) el.addEventListener("scroll", queueBottomStateUpdate, { passive: true });

  updateBottomState();
});

onBeforeUnmount(() => {
  const el = getMainScroller();
  if (el) el.removeEventListener("scroll", queueBottomStateUpdate);

  if (scrollRaf) cancelAnimationFrame(scrollRaf);

  // If component unmounts while resizing, clean up.
  document.documentElement.classList.remove("no-select");
  if (onMove) window.removeEventListener("pointermove", onMove);
  if (onUp) window.removeEventListener("pointerup", onUp);
  onMove = null;
  onUp = null;
});
</script>
