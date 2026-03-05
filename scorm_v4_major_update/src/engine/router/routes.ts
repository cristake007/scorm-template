import type { RouteRecordRaw } from "vue-router";
import type { CourseModel } from "../course/courseLoader";

export function buildRoutes(course: CourseModel): RouteRecordRaw[] {
  const PageView = () => import("../../views/PageView.vue");

  const routes: RouteRecordRaw[] = [];

  // System routes (from JSON)
  for (const r of course.system?.routes ?? []) {
    routes.push({
      path: r.route,
      component: PageView,
      meta: { system: true, systemId: r.id }
    });
  }

  // Determine fallback + start route
  const firstChapter = course.lessons[0]?.chapters[0]?.route;
  const fallback = course.system?.fallbackRoute || firstChapter || "/overview";

  routes.push({ path: "/", redirect: course.system?.fallbackRoute || "/overview" });

  // Chapter routes (from JSON)
  for (const lesson of course.lessons) {
    for (const ch of lesson.chapters) {
      routes.push({
        path: ch.route,
        component: PageView,
        meta: {
          lessonId: lesson.id,
          chapterId: ch.id,
          required: ch.required ?? true
        }
      });
    }
  }

  // Catch-all → JSON fallback
  routes.push({ path: "/:pathMatch(.*)*", redirect: fallback });

  return routes;
}