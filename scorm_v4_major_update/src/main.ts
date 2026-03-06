import { createApp, h, defineComponent } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";

import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.css";
import { createVuetify } from "vuetify";
import { aliases, mdi } from "vuetify/iconsets/mdi";

import App from "./App.vue";

import { installRuntimeStore } from "./core/runtime/runtimeStore";
import { loadCourse } from "./engine/course/courseLoader";
import { buildRoutes } from "./engine/router/routes";
import { useScormRuntime } from "./scorm/useScormRuntime";

import "./styles/master.css";

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

  await runtime.ready;
  await router.isReady();
  app.mount("#app");
}

void boot();
