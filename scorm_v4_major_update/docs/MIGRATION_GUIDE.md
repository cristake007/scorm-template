# 5-Minute Guide: Add a New Lesson

## 1) Create a lesson file
Add a new file under:

`src/content/course/lessons/<lesson-id>.json`

Use this shape:
- `id`
- `title`
- `chapters[]` with `id`, `route`, `page.blocks`

## 2) Register lesson order
Open `src/content/course/meta.json` and append your lesson id to `lessonOrder`.

## 3) Add chapter content only
Add blocks in the chapter `page.blocks` array. Reuse existing block types.
No router code changes are required.

## 4) Configure completion
Set per chapter completion mode:
- `manual`
- `viewed`
- `quiz`
- `viewed+quiz`

`PageView` + `progressStore.reconcileCourseState()` handle completion state updates.

## 5) Validate
Run:
```bash
npm run build
```

## 6) LMS smoke test
- Launch in LMS
- Complete a chapter in new lesson
- Refresh
- Verify bookmark + suspend data persistence

> If no LMS API is present, offline mode persists state via localStorage.
