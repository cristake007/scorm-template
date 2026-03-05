import fs from "node:fs";
import path from "node:path";

const id = process.argv[2];
if (!id) {
  console.error("Usage: npm run lesson:new -- <lesson-id>");
  process.exit(1);
}

const root = process.cwd();
const lessonPath = path.join(root, "src", "content", "course", "lessons", `${id}.json`);
if (fs.existsSync(lessonPath)) {
  console.error(`Lesson already exists: ${lessonPath}`);
  process.exit(1);
}

const lesson = {
  id,
  title: `Lesson ${id}`,
  chapters: [
    {
      id: "ch-1",
      title: "New Chapter",
      route: `/${id}/chapter-1`,
      required: true,
      completion: { mode: "viewed" },
      page: {
        layout: { maxWidth: "xl", gap: "lg" },
        blocks: [
          { type: "text", variant: "h1", text: `Welcome to ${id}` },
          { type: "text", variant: "muted", text: "Edit this chapter content." }
        ]
      }
    }
  ]
};

fs.mkdirSync(path.dirname(lessonPath), { recursive: true });
fs.writeFileSync(lessonPath, `${JSON.stringify(lesson, null, 2)}\n`);
console.log(`✅ Created ${path.relative(root, lessonPath)}`);
