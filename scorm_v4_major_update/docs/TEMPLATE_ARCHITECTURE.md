# Template Architecture (Vue 3 + SCORM 2004)

## Revised Folder Structure

```txt
src/
  core/
    runtime/
      runtimeStore.ts          # Runtime store contract + provide plugin helper
  layouts/
    DefaultLayout.vue          # Swappable top-level layout shell
  app/
    AppShell.vue               # Default UI shell implementation
  views/
    PageView.vue               # SCO/page entry view
  blocks/                      # Content blocks (rendered by PageView)
  engine/
    course/                    # Dynamic course loading
    router/                    # Route generation + guards
    progress/                  # Progress model + reconciliation
    navigation/                # Side-nav view models
    appContext.ts              # Compatibility context injection for blocks/views
  scorm/
    scormClient.ts             # SCORM API client adapter (LMS/offline)
    useScormRuntime.ts         # Runtime orchestration composable
```

## Scalability Rules

1. All SCORM writes go through `scormClient` via `useScormRuntime` / progress services.
2. New layout themes should be introduced under `src/layouts` (no logic changes required in `main.ts`).
3. Page route registration is data-driven from `src/content/course.json` and `buildRoutes()`.
4. View components should avoid LMS lifecycle hooks; keep those in runtime/composables.
