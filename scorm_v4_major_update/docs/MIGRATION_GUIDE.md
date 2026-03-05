# 5-Minute Guide: Add a New Lesson

## 1) Create a lesson file
Run:

```bash
npm run lesson:new -- lesson-4
```

This creates `src/content/course/lessons/lesson-4.json`.

## 2) Register lesson order
Open `src/content/course/meta.json` and append your lesson id to `lessonOrder`.

## 3) Add chapters quickly
Use chapter scaffolding:

```bash
npm run chapter:new -- lesson-4 ch-2
```

## 4) Add blocks quickly (including quiz blocks)
Append block templates to a specific chapter:

```bash
npm run block:add -- lesson-4 ch-2 text
npm run block:add -- lesson-4 ch-2 quiz.multipleChoice
npm run block:add -- lesson-4 ch-2 quiz.cloze
npm run block:add -- lesson-4 ch-2 quiz.matching
npm run block:add -- lesson-4 ch-2 quiz.drag-and-drop
npm run block:add -- lesson-4 ch-2 gpt.agent
npm run block:add -- lesson-4 ch-2 timeline
```

Supported block templates:
- `text`
- `image`
- `accordion`
- `quiz.mcq` / `quiz.multipleChoice`
- `quiz.clozeSelect` / `quiz.cloze`
- `quiz.match` / `quiz.matching`
- `quiz.dragWords` / `quiz.drag-and-drop`
- `agent.gptChat` / `gpt.agent`
- `timeline.events` / `timeline`

## 5) Configure completion
Set per chapter completion mode:
- `manual`
- `viewed`
- `quiz`
- `viewed+quiz`

`PageView` + `progressStore.reconcileCourseState()` handle completion updates.

## 6) Validate and build
Run:

```bash
npm run validate:content
npm run build
```

## 7) LMS smoke test
- Launch in LMS (SCORM 2004 3rd Edition)
- Complete a chapter in new lesson
- Refresh
- Verify bookmark + suspend data persistence

> Offline fallback is enabled only in local DEV (`vite dev`) to keep production strictly LMS-backed.
