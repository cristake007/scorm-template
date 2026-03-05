import fs from "node:fs";
import path from "node:path";

const lessonId = process.argv[2];
const chapterId = process.argv[3];
if (!lessonId || !chapterId) {
  console.error("Usage: npm run chapter:new -- <lesson-id> <chapter-id>");
  process.exit(1);
}

const root = process.cwd();
const lessonPath = path.join(root, "src", "content", "course", "lessons", `${lessonId}.json`);
if (!fs.existsSync(lessonPath)) {
  console.error(`Missing lesson file: ${lessonPath}`);
  process.exit(1);
}

const lesson = JSON.parse(fs.readFileSync(lessonPath, "utf8"));
if (lesson.chapters.some((c) => c.id === chapterId)) {
  console.error(`Chapter already exists: ${lessonId}/${chapterId}`);
  process.exit(1);
}

lesson.chapters.push({
  id: chapterId,
  title: `Chapter ${chapterId}`,
  route: `/${lessonId}/${chapterId}`,
  required: true,
  completion: { mode: "viewed" },
  page: {
    layout: { maxWidth: "xl", gap: "lg" },
    blocks: [
      { type: "text", variant: "h1", text: `${lessonId} / ${chapterId}` },
      { type: "text", variant: "muted", text: "Edit this chapter content." }
    ]
  }
});

fs.writeFileSync(lessonPath, `${JSON.stringify(lesson, null, 2)}\n`);
console.log(`✅ Added ${chapterId} to ${path.relative(root, lessonPath)}`);
