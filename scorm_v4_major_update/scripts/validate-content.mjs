import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const contentRoot = path.join(root, "src", "content", "course");
const metaPath = path.join(contentRoot, "meta.json");
const lessonsDir = path.join(contentRoot, "lessons");

function fail(message) {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

if (!fs.existsSync(metaPath)) {
  fail("Missing src/content/course/meta.json");
  process.exit(1);
}

const meta = readJson(metaPath);
const lessonFiles = fs.existsSync(lessonsDir)
  ? fs.readdirSync(lessonsDir).filter((f) => f.endsWith(".json")).sort()
  : [];

if (!lessonFiles.length) {
  fail("No lesson files found in src/content/course/lessons");
}

const lessons = lessonFiles.map((file) => readJson(path.join(lessonsDir, file)));
const lessonIds = new Set();
const routes = new Set((meta.system?.routes ?? []).map((r) => r.route));

for (const lesson of lessons) {
  if (!lesson.id) fail(`Lesson missing id in file content: ${JSON.stringify(lesson).slice(0, 80)}...`);
  if (lessonIds.has(lesson.id)) fail(`Duplicate lesson id: ${lesson.id}`);
  lessonIds.add(lesson.id);

  if (!Array.isArray(lesson.chapters) || !lesson.chapters.length) {
    fail(`Lesson ${lesson.id} has no chapters`);
    continue;
  }

  const chapterIds = new Set();
  for (const chapter of lesson.chapters) {
    if (!chapter.id) fail(`Lesson ${lesson.id} chapter missing id`);
    if (chapterIds.has(chapter.id)) fail(`Lesson ${lesson.id} duplicate chapter id: ${chapter.id}`);
    chapterIds.add(chapter.id);

    if (!chapter.route || !String(chapter.route).startsWith("/")) {
      fail(`Invalid route for ${lesson.id}/${chapter.id}: ${chapter.route}`);
    }

    if (routes.has(chapter.route)) fail(`Duplicate route: ${chapter.route}`);
    routes.add(chapter.route);

    const blocks = chapter.page?.blocks;
    if (!Array.isArray(blocks) || !blocks.length) {
      fail(`Chapter ${lesson.id}/${chapter.id} has no page.blocks`);
    }
  }
}

const order = meta.lessonOrder ?? [];
for (const orderedId of order) {
  if (!lessonIds.has(orderedId)) {
    fail(`lessonOrder references missing lesson: ${orderedId}`);
  }
}

if (!process.exitCode) {
  console.log(`✅ Content validation passed (${lessons.length} lesson files)`);
}
