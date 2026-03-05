<template>
  <v-app>
    <v-layout class="appLayout" :class="{ drawerClosed: !drawerOpen }">
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
        

        <v-btn color="primary" variant="tonal" @click="finishAndExit">
          Finish & Exit
        </v-btn>

        <v-dialog v-model="finishDialog" max-width="520">
          <v-card>
            <v-card-title>Finished</v-card-title>
            <v-card-text>
              Your attempt was saved and finalized. You can now close this tab/window.
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn color="primary" @click="finishDialog=false">OK</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>


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
                <div style="display:flex; align-items:center; gap:10px;">
                  <v-progress-circular
                    :model-value="lesson.progressPercent"
                    size="18"
                    width="2"
                    color="primary"
                  />
                  <v-icon
                    :icon="isLessonOpen(lesson.lessonId) ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                    :color="isLessonOpen(lesson.lessonId) ? 'primary' : 'grey'"
                  />
                </div>
              </div>
            </div>
          </v-btn>

          <div class="navDivider"></div>

          <div v-show="isLessonOpen(lesson.lessonId)">
            <v-btn
              v-for="(ch, idx) in lesson.chapters"
              :key="ch.route"
              :to="ch.route"
              variant="text"
              block
              rounded="0"
              :ripple="false"
              class="navRow navRow--child"
              :disabled="false"
              :class="{ 'navRow--active': route.path === ch.route }"
            >
              <div class="navRow__inner">
                <div class="navRow__left">
                  <span class="navRow__index">{{ idx + 1 }}</span>

                  <div class="navRow__text">
                    <div class="navRow__title" :class="{ 'navRow__title--bold': route.path === ch.route }">
                      {{ ch.title }}
                    </div>
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
import { ref, watch, onBeforeUnmount, inject } from "vue";
import { useDisplay } from "vuetify";
import { useRoute } from "vue-router";
import type { NavLesson } from "../engine/navigation/navModel";
import { AppContextKey } from "../engine/appContext";

defineProps<{
  courseTitle: string;
  courseVersion: string;
  nav: NavLesson[];
  lockedMessage: string;
  logoUrl?: string;
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

//something something test
window.addEventListener("beforeunload", () => {
  try {
    if (!scorm.initialized) return;
    scorm.set("cmi.exit", "normal");
    scorm.commit();
    scorm.terminate();
  } catch {}
});

const ctx = inject(AppContextKey);
if (!ctx) throw new Error("AppContext not provided");
const { scorm } = ctx;

const finishDialog = ref(false);
const sessionStartMs = Date.now();

function formatSessionTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `PT${h}H${m}M${s}S`;
}



function scormSetDbg(scorm: any, key: string, val: any) {
  const v = String(val ?? "");
  const ok = scorm.set(key, v);
  const after = scorm.get?.(key);
  const err = scorm.getLastError?.();

  // eslint-disable-next-line no-console
  console.log(`[SCORM set] ${key}=${v} -> ok=${ok}`, { after, err });

  return ok;
}

function scormCallDbg(scorm: any, label: string, fn: () => any) {
  try {
    const res = fn();
    // eslint-disable-next-line no-console
    console.log(`[SCORM ${label}] ok`, { res, err: scorm.getLastError?.() });
    return res;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`[SCORM ${label}] FAILED`, e, { err: scorm.getLastError?.() });
    throw e;
  }
}




// function finishAndExit() {
//   try {
//     if (!scorm.initialized) return;

//     // Finalize status (for ILIAS dashboards)
//     scorm.set("cmi.completion_status", "completed");
//     scorm.set("cmi.success_status", "passed");

//     // Ensure attempt is ended cleanly
//     scorm.set("cmi.exit", "normal");
//     scorm.set("cmi.session_time", formatSessionTime(Date.now() - sessionStartMs));

//     scorm.commit();
//     scorm.terminate();

//     finishDialog.value = true;
//   } catch {
//     // ignore
//   }
// }


const isFinishing = ref(false);

function finishAndExit() {
  try {
    if (!scorm.initialized) return;

    isFinishing.value = true;

    const ms = Date.now() - sessionStartMs;
    const sessionTime = formatSessionTime(ms); // ISO duration: PT#H#M#S

    console.log("[SCORM] finishAndExit start", { ms, sessionTime });

    // 1) Force ILIAS-friendly “done” progress
    scorm.set("cmi.progress_measure", "1.0000");
    scorm.set("cmi.score.scaled", "1.0000");
    scorm.set("cmi.score.raw", "100");
    scorm.set("cmi.score.min", "0");
    scorm.set("cmi.score.max", "100");

    // 2) Status
    scorm.set("cmi.completion_status", "completed");
    scorm.set("cmi.success_status", "passed");

    // 3) End attempt cleanly
    scorm.set("cmi.session_time", sessionTime);

    // NOTE: for SCORM 2004, many LMS accept "normal" or "".
    // If ILIAS still behaves weirdly, try "" instead of "normal".
    scorm.set("cmi.exit", "normal");

    // 4) Commit + terminate
    scorm.commit();
    scorm.terminate();

    // IMPORTANT: don’t try to scorm.get(...) after terminate — it will look empty.
    console.log("[SCORM] finishAndExit end (terminated)");
    finishDialog.value = true;
  } catch (e) {
    console.warn("[SCORM] finishAndExit failed", e);
  } finally {
    isFinishing.value = false;
  }
}

</script>