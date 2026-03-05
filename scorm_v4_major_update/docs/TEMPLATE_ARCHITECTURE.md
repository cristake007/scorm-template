# Template Architecture (Vue 3 + SCORM 2004 3rd Edition)

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
    scormClient.ts             # SCORM API client adapter (LMS/offline dev)
    useScormRuntime.ts         # Runtime orchestration composable
  content/
    course/
      meta.json                # Global course/system metadata + lessonOrder
      lessons/
        lesson-1.json          # One lesson per file (chapters nested)
        lesson-2.json
    course.json                # Legacy fallback only (backward compatibility)
  styles/
    base.css                   # html/body resets and global defaults
    master.css                 # color + surface design tokens
    theme.css                  # corporate typography/spacing/button token contract
    shell.css                  # fixed shell geometry and scroll behavior
    app-shell.css              # AppShell visual styles + accessibility helpers
    page-view.css              # PageView-specific layout styles
scripts/
  validate-content.mjs         # content integrity validation gate
  scaffold-lesson.mjs          # creates lesson boilerplate
  scaffold-chapter.mjs         # adds chapter boilerplate to lesson
  scaffold-block.mjs           # appends block templates (incl. quiz blocks) to chapter
```

## Professionalization Rules

1. **Content is modular**: authoring happens in `content/course/lessons/*.json`, not a monolithic file.
2. **Automated content QA**: run `npm run validate:content` before packaging.
3. **UI and content are separated**: style changes happen in `styles/*.css` without editing Vue templates.
4. **SCORM is centralized**: LMS calls flow through runtime/progress services.
5. **Accessibility baseline**: include skip link, clear focus rings, keyboard-safe dialogs, and first-run guided onboarding.


## Human-friendly block names

To improve author ergonomics, quiz block aliases are supported and normalized:
- `quiz.multipleChoice` -> `quiz.mcq`
- `quiz.cloze` -> `quiz.clozeSelect`
- `quiz.matching` -> `quiz.match`
- `quiz.drag-and-drop` -> `quiz.dragWords`

This works both in content files and in CLI block scaffolding.

Additional block aliases:
- `gpt.agent` -> `agent.gptChat`
- `timeline` -> `timeline.events`
