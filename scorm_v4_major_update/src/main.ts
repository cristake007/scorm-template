import { createApp, ref, reactive, computed, h, defineComponent, provide } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";

import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.css";
import { createVuetify } from "vuetify";
import { aliases, mdi } from "vuetify/iconsets/mdi";

import App from "./App.vue";

import { loadCourse } from "./engine/course/courseLoader";
import { buildRoutes } from "./engine/router/routes";
import { installCourseGuards } from "./engine/router/guards";
import { createScormClientStrict } from "./scorm/scormClient";

import { loadProgress } from "./engine/progress/progressStore";
import { saveProgress } from "./engine/progress/progressStore";
import { buildNav } from "./engine/navigation/navModel";

import { AppContextKey } from "./engine/appContext";

import "./styles/master.css";
import "./styles/tokens.css"; // optional: remove later once migrated
import "./styles/base.css";
import "./styles/components.css";
import "./styles/shell.css";

const vuetify = createVuetify({
  icons: { defaultSet: "mdi", aliases, sets: { mdi } }
});

async function boot() {
  // 1) Load course JSON (single source of truth)
  const course = await loadCourse();

  // 2) Router from course.json
  const router = createRouter({
    history: createWebHashHistory(),
    routes: buildRoutes(course)
  });

  // 3) Strict SCORM client
  const scorm = createScormClientStrict();
  const ok = scorm.initialize();
  if (!ok) {
    document.getElementById("app")!.innerHTML = `
      <div style="min-height:100vh;display:grid;place-items:center;font-family:system-ui;background:#f6f7fb;padding:24px;">
        <div style="max-width:720px;background:#fff;border:1px solid rgba(0,0,0,.12);border-radius:16px;padding:18px;">
          <h2 style="margin:0 0 8px 0;">SCORM API not found</h2>
          <p style="margin:0;color:rgba(0,0,0,.7);line-height:1.4;">
            This package must be launched from an LMS that exposes <b>API_1484_11</b> (SCORM 2004).
          </p>
        </div>
      </div>
    `;
    return;
  }

  // 4) Load progress once + make reactive
  const state = reactive(loadProgress(scorm, course));

  // 5) Reactive nav derived from course + state
  const nav = computed(() => buildNav(course, state));

  const lockedMessage = ref("");

  // 6) Guards: linear unlock + bookmarking
  installCourseGuards({
    router,
    course,
    scorm,
    state,
    onLockedRedirect(msg) {
      lockedMessage.value = msg;
      window.setTimeout(() => (lockedMessage.value = ""), 3500);
    }
  });

  // 7) Resume from bookmark (best-effort)
  const bookmark = scorm.get("cmi.location") || "";
  if (bookmark) {
    try {
      router.replace(bookmark);
    } catch {
      /* ignore invalid bookmark */
    }
  }

  // 8) Root wrapper provides ctx + passes computed nav
  const Root = defineComponent({
    name: "Root",
    setup() {
      provide(AppContextKey, { course, scorm, state });
      return () =>
        h(App as any, {
          courseTitle: course.course.title,
          courseVersion: `v${course.course.version}`,
          nav: nav.value,
          lockedMessage: lockedMessage.value
        });
    }
  });

  function suspendAndTerminate() {
  try {
    // ensure latest state is written
    saveProgress(scorm, state);

    // IMPORTANT for SCORM 2004: tell LMS we are suspending (so suspend_data/location should be kept)
    scorm.set("cmi.exit", "suspend");

    // best-effort push
    scorm.commit();

    // close the SCORM session
    scorm.terminate();
  } catch {
    /* noop */
  }
}

// pagehide is more reliable than beforeunload on modern browsers
window.addEventListener("pagehide", suspendAndTerminate);

// keep beforeunload as fallback
window.addEventListener("beforeunload", suspendAndTerminate);

  createApp(Root).use(router).use(vuetify).mount("#app");
}

boot();