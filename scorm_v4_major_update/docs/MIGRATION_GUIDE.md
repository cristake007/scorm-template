# 5-Minute Guide: Add a New Lesson

## 1) Edit `course.json`
Add a new lesson object under `course.lessons` with:
- unique `id`
- `title`
- one or more `chapters` with unique `id` + `route` + `page.blocks`

`buildRoutes()` will auto-register chapter routes from this JSON.

## 2) Add content blocks only
Use existing block types in each chapter's `page.blocks`.
No router or SCORM code changes are required.

## 3) Completion mode
Set chapter completion in JSON:
- `manual`
- `viewed`
- `quiz`
- `viewed+quiz`

`PageView` + `progressStore.reconcileCourseState()` handle the rest.

## 4) Validate locally
Run:
```bash
npm run build
```

## 5) LMS smoke test
- Launch SCO in LMS
- Complete content in new lesson
- Refresh
- Verify bookmark + completion persist

If running outside LMS, offline mode persists to localStorage automatically.
