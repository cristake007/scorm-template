# Template Architecture (Vue 3 + SCORM 2004)

## Revised Folder Structure

```txt
src/
  core/
    runtime/
      runtimeStore.ts          # Runtime store contract + provider helper
  layouts/
    DefaultLayout.vue          # Swappable top-level shell
  app/
    AppShell.vue               # UI frame only (header + drawer + content outlet)
  views/
    PageView.vue               # SCO/page entry view (logic only)
  blocks/                      # Content blocks renderer components
  engine/
    course/
      courseLoader.ts          # Validates and assembles modular content
    router/
      routes.ts                # Generates routes from content model
      guards.ts                # Progress/bookmark enforcement
    progress/                  # Reconciliation and persistence logic
  scorm/
    scormClient.ts             # SCORM API client adapter (LMS/offline)
    useScormRuntime.ts         # Runtime orchestration composable
  content/
    course/
      meta.json                # Global course/system metadata
      lessons/
        lesson-1.json          # One lesson per file (chapters nested)
        lesson-2.json
    course.json                # Legacy fallback only (backward compatibility)
  styles/
    base.css                   # html/body resets and global defaults
    master.css                 # design tokens and utility primitives
    shell.css                  # fixed shell geometry and scroll behavior
    app-shell.css              # AppShell visual styles (nav, header)
    page-view.css              # PageView-specific layout styles
```

## Scalability Rules

1. **Content is modular**: authoring happens in `content/course/lessons/*.json`, not in one monolithic file.
2. **UI and content are separated**: layout/theme changes happen in `layouts/` + `styles/` without touching course JSON.
3. **SCORM stays centralized**: components never call LMS directly unless through runtime/progress services.
4. **Vue files contain template + logic only**: styles live in `src/styles/*.css` files.
5. **Fixed frame UX**: top bar and navigation stay fixed; only content panes scroll.
