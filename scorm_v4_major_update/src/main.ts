import { createApp, h, defineComponent } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";

import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.css";
import { createVuetify } from "vuetify";
import { aliases, mdi } from "vuetify/iconsets/mdi";

import App from "./App.vue";

import { installRuntimeStore } from "./core/runtime/runtimeStore";
import { loadCourse } from "./engine/course/courseLoader";
import { saveProgress } from "./engine/progress/progressStore";
import { buildRoutes } from "./engine/router/routes";
import { useScormRuntime } from "./scorm/useScormRuntime";

import "./styles/master.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/shell.css";
import "./styles/app-shell.css";
import "./styles/page-view.css";
import "./styles/theme.css";

const vuetify = createVuetify({
  icons: { defaultSet: "mdi", aliases, sets: { mdi } }
});

async function boot() {
  const course = await loadCourse();

  const router = createRouter({
    history: createWebHashHistory(),
    routes: buildRoutes(course)
  });

  const runtime = useScormRuntime(course, router);

  const Root = defineComponent({
    name: "Root",
    setup() {
      return () =>
        h(App as any, {
          courseTitle: course.course.title,
          courseVersion: `v${course.course.version}`,
          nav: runtime.nav.value,
          lockedMessage: runtime.lockedMessage.value
        });
    }
  });

  const app = createApp(Root).use(router).use(vuetify);
  installRuntimeStore(app, runtime);

  app.mount("#app");

  window.addEventListener("pagehide", () => {
    try {
      saveProgress(runtime.scorm, runtime.state);
      runtime.scorm.commit();
    } finally {
      runtime.cleanup();
    }
  });
}

boot();
