<template>
  <v-app>
    <v-layout class="appLayout">
      <v-app-bar color="surface" :elevation="2" density="comfortable" :height="80">
        <template #prepend>
          <v-app-bar-nav-icon icon="mdi-menu" @click="drawerOpen = !drawerOpen" />
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

      <v-navigation-drawer
        v-model="drawerOpen"
        :width="drawerWidth"
        :temporary="!mdAndUp"
        :permanent="mdAndUp"
        class="navDrawer"
        :class="{ isResizing: resizing }"
      >
        <v-btn
          to="/overview"
          variant="text"
          block
          rounded="0"
          :ripple="false"
          class="navRow navRow--root"
          :class="{ 'navRow--active': route.path === '/overview' }"
        >
          <div class="navRow__inner">
            <div class="navRow__left">
              <span class="navRow__title navRow__title--bold">Overview</span>
            </div>
          </div>
        </v-btn>

        <div class="navDivider"></div>

        <template v-for="lesson in nav" :key="lesson.lessonId">
          <v-btn
            variant="text"
            block
            rounded="0"
            :ripple="false"
            class="navRow navRow--root"
            @click="toggleLesson(lesson.lessonId)"
          >
            <div class="navRow__inner">
              <div class="navRow__left">
                <span class="navRow__title">{{ lesson.title }}</span>
              </div>
              <div class="navRow__right">
                <v-icon
                  :icon="isLessonOpen(lesson.lessonId) ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                  :color="isLessonOpen(lesson.lessonId) ? 'primary' : 'grey'"
                />
              </div>
            </div>
          </v-btn>

          <div class="navDivider"></div>

          <div v-show="isLessonOpen(lesson.lessonId)">
            <v-btn
              v-for="(ch, idx) in lesson.chapters"
              :key="ch.route"
              :to="lesson.unlocked ? ch.route : undefined"
              variant="text"
              block
              rounded="0"
              :ripple="false"
              class="navRow navRow--child"
              :disabled="!lesson.unlocked"
              :class="{ 'navRow--active': route.path === ch.route }"
            >
              <div class="navRow__inner">
                <div class="navRow__left">
                  <span class="navRow__index">{{ idx + 1 }}</span>

                  <div class="navRow__text">
                    <div class="navRow__title" :class="{ 'navRow__title--bold': route.path === ch.route }">
                      {{ ch.title }}
                    </div>
                    <div v-if="!lesson.unlocked" class="navRow__subtitle">Locked</div>
                  </div>
                </div>

                <div class="navRow__right">
                  <v-icon
                    :icon="ch.completed ? 'mdi-check-circle' : 'mdi-check-circle-outline'"
                    :color="ch.completed ? 'primary' : 'grey-lighten-1'"
                  />
                </div>
              </div>
            </v-btn>

            <div class="navDivider"></div>
          </div>
        </template>

        <div v-if="lockedMessage" class="navLockedMsg">
          {{ lockedMessage }}
        </div>

        <div
          v-if="mdAndUp"
          ref="resizerEl"
          class="drawerResizer"
          role="separator"
          aria-label="Resize navigation"
          @pointerdown="startResize"
        />
      </v-navigation-drawer>

      <v-main>
        <router-view />
      </v-main>
    </v-layout>
  </v-app>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from "vue";
import { useDisplay } from "vuetify";
import { useRoute } from "vue-router";
import type { NavLesson } from "../engine/navigation/navModel";

defineProps<{
  courseTitle: string;
  courseVersion: string;
  nav: NavLesson[];
  lockedMessage: string;
}>();


const { mdAndUp } = useDisplay();
const route = useRoute();

const drawerOpen = ref(mdAndUp.value);
watch(mdAndUp, (isDesktop) => {
  drawerOpen.value = isDesktop;
});

const MIN_W = 280;
const MAX_W = () => Math.min(520, window.innerWidth - 80);
const drawerWidth = ref(360);

const openLessons = ref(new Set<string>());
function isLessonOpen(id: string) {
  return openLessons.value.has(id);
}
function toggleLesson(id: string) {
  const next = new Set(openLessons.value);
  next.has(id) ? next.delete(id) : next.add(id);
  openLessons.value = next;
}

const resizing = ref(false);
const resizerEl = ref<HTMLElement | null>(null);

let onMove: ((e: PointerEvent) => void) | null = null;
let onUp: ((e: PointerEvent) => void) | null = null;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function startResize(e: PointerEvent) {
  const el = resizerEl.value;
  if (!el) return;

  resizing.value = true;
  document.documentElement.classList.add("no-select");
  el.setPointerCapture(e.pointerId);

  onMove = (ev: PointerEvent) => {
    if (!resizing.value) return;
    drawerWidth.value = clamp(ev.clientX, MIN_W, MAX_W());
  };

  onUp = () => {
    resizing.value = false;
    document.documentElement.classList.remove("no-select");
    window.removeEventListener("pointermove", onMove!);
    window.removeEventListener("pointerup", onUp!);
    onMove = null;
    onUp = null;
  };

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerup", onUp, { once: true });

  e.preventDefault();
}

onBeforeUnmount(() => {
  document.documentElement.classList.remove("no-select");
  if (onMove) window.removeEventListener("pointermove", onMove);
  if (onUp) window.removeEventListener("pointerup", onUp);
});

// Optional logo
const logoUrl = "./src/assets/images/logo.svg";
</script>