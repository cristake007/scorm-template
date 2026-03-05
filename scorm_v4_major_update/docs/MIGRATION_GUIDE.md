# 5-Minute Guide: Add a New Lesson

## 1) Create a lesson file
Run:

```bash
npm run lesson:new -- lesson-4
```

This creates `src/content/course/lessons/lesson-4.json`.

## 2) Register lesson order
Open `src/content/course/meta.json` and append your lesson id to `lessonOrder`.

## 3) Add chapter content only
Either edit the generated chapter or scaffold another one:

```bash
npm run chapter:new -- lesson-4 ch-2
```

Then edit `page.blocks` and reuse existing block types.

## 4) Configure completion
Set per chapter completion mode:
- `manual`
- `viewed`
- `quiz`
- `viewed+quiz`

`PageView` + `progressStore.reconcileCourseState()` handle completion updates.

## 5) Validate and build
Run:

```bash
npm run validate:content
npm run build
```

## 6) LMS smoke test
- Launch in LMS (SCORM 2004 3rd Edition)
- Complete a chapter in new lesson
- Refresh
- Verify bookmark + suspend data persistence

> Offline fallback is enabled only in local DEV (`vite dev`) to keep production strictly LMS-backed.
