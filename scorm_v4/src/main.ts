import { createApp, h, ref } from "vue";
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
import { buildNav } from "./engine/navigation/navModel";

import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/shell.css";

const vuetify = createVuetify({
  icons: { defaultSet: "mdi", aliases, sets: { mdi } }
});

async function boot() {
  // 1) Load course JSON (single source of truth)
  const course = await loadCourse();

  // 2) Create router from course.json (no hardcoded chapter paths)
  const router = createRouter({
    history: createWebHashHistory(),
    routes: buildRoutes(course)
  });

  // 3) Strict SCORM client (no mock): hard-fail if API missing
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

  // 4) Load progress from suspend_data (single source of truth)
  const state = loadProgress(scorm, course);

  // 5) Reactive nav model (computed from course + progress)
  const nav = ref(buildNav(course, state));
  const lockedMessage = ref("");

  function refreshNav() {
    nav.value = buildNav(course, state);
  }

  // 6) Guards: linear unlock + route bookmark persistence
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

  // 7) Resume from bookmark (cmi.location) if valid
  const bookmark = scorm.get("cmi.location") || "";
  if (bookmark) {
    const valid = router.getRoutes().some((r) => r.path === bookmark);
    if (valid) router.replace(bookmark);
  }

  // 8) Refresh nav after each navigation (so checkmarks/locks update)
  router.afterEach(() => refreshNav());

  // 9) Mount app
  createApp({
    render: () =>
      h(App, {
        courseTitle: course.course.title,
        courseVersion: `v${course.course.version}`,
        nav: nav.value,
        lockedMessage: lockedMessage.value,
        exit: () => {
          try {
            scorm.commit();
            scorm.terminate();
          } catch {
            /* noop */
          }
        }
      })
  })
    .use(router)
    .use(vuetify)
    .mount("#app");
}

boot();