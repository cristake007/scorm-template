import fs from "node:fs";
import path from "node:path";

const lessonId = process.argv[2];
const chapterId = process.argv[3];
const blockTypeArg = process.argv[4];

if (!lessonId || !chapterId || !blockTypeArg) {
  console.error("Usage: npm run block:add -- <lesson-id> <chapter-id> <block-type>");
  process.exit(1);
}

const TYPE_ALIASES = {
  "quiz.multipleChoice": "quiz.mcq",
  "quiz.cloze": "quiz.clozeSelect",
  "quiz.matching": "quiz.match",
  "quiz.drag-and-drop": "quiz.dragWords",
  "gpt.agent": "agent.gptChat",
  "timeline": "timeline.events"
};

const blockType = TYPE_ALIASES[blockTypeArg] ?? blockTypeArg;

const templates = {
  text: (id) => ({ id, type: "text", variant: "body", text: "New text block" }),
  image: (id) => ({ id, type: "image", src: "./assets/images/diagram-1.png", alt: "Image" }),
  accordion: (id) => ({
    id,
    type: "accordion",
    title: "New accordion",
    items: [
      { id: `${id}-1`, title: "Item 1", body: "Accordion item body." },
      { id: `${id}-2`, title: "Item 2", body: "Accordion item body." }
    ]
  }),
  "quiz.mcq": (id) => ({
    id,
    type: "quiz.mcq",
    quizId: `${id}-quiz`,
    title: "Multiple Choice Quiz",
    scoreMax: 100,
    passScore: 80,
    attemptsAllowed: 0,
    shuffleOptions: true,
    questions: [
      {
        id: "q1",
        prompt: "Replace with your question",
        options: [
          { id: "a", text: "Option A" },
          { id: "b", text: "Option B" }
        ],
        correct: ["a"]
      }
    ]
  }),
  "quiz.clozeSelect": (id) => ({
    id,
    type: "quiz.clozeSelect",
    quizId: `${id}-quiz`,
    title: "Cloze Select Quiz",
    scoreMax: 100,
    passScore: 80,
    items: [
      { id: "c1", textBefore: "The capital of France is", options: ["Paris", "Berlin"], correct: "Paris" }
    ]
  }),
  "quiz.match": (id) => ({
    id,
    type: "quiz.match",
    quizId: `${id}-quiz`,
    title: "Matching Quiz",
    scoreMax: 100,
    passScore: 80,
    pairs: [
      { leftId: "l1", left: "HTML", rightId: "r1", right: "Markup" },
      { leftId: "l2", left: "CSS", rightId: "r2", right: "Styling" }
    ]
  }),
  "quiz.dragWords": (id) => ({
    id,
    type: "quiz.dragWords",
    quizId: `${id}-quiz`,
    title: "Drag Words Quiz",
    scoreMax: 100,
    passScore: 80,
    parts: [
      { t: "Vue is a" },
      { blankId: "b1" },
      { t: "framework." }
    ],
    words: [
      { id: "w1", text: "JavaScript" },
      { id: "w2", text: "database" }
    ],
    correct: { b1: "w1" }
  }),

  "agent.gptChat": (id) => ({
    id,
    type: "agent.gptChat",
    title: "GPT Agent Simulation",
    typingSpeedMs: 20,
    turns: [
      {
        agent: "Hello! I can help you with this scenario. What would you do first?",
        userReply: "I would first identify stakeholder requirements.",
        userReplyLabel: "Simulate learner reply"
      },
      {
        agent: "Great approach. Next, prioritize tasks and define ownership.",
        userReply: "Then I would communicate the plan to the team.",
        userReplyLabel: "Simulate follow-up reply"
      },
      {
        agent: "Perfect. That sequence increases alignment and execution speed."
      }
    ]
  }),
  "timeline.events": (id) => ({
    id,
    type: "timeline.events",
    title: "Project Timeline",
    orientation: "vertical",
    items: [
      { id: `${id}-1`, date: "Week 1", title: "Kickoff", description: "Define scope and goals." },
      { id: `${id}-2`, date: "Week 2", title: "Execution", description: "Implement agreed tasks." },
      { id: `${id}-3`, date: "Week 3", title: "Review", description: "Collect feedback and finalize." }
    ]
  }),
};

if (!templates[blockType]) {
  console.error(`Unsupported block type: ${blockTypeArg}`);
  console.error(`Available: ${Object.keys(templates).join(", ")}, ${Object.keys(TYPE_ALIASES).join(", ")}`);
  process.exit(1);
}

const root = process.cwd();
const lessonPath = path.join(root, "src", "content", "course", "lessons", `${lessonId}.json`);
if (!fs.existsSync(lessonPath)) {
  console.error(`Missing lesson file: ${lessonPath}`);
  process.exit(1);
}

const lesson = JSON.parse(fs.readFileSync(lessonPath, "utf8"));
const chapter = lesson.chapters.find((c) => c.id === chapterId);
if (!chapter) {
  console.error(`Chapter not found: ${lessonId}/${chapterId}`);
  process.exit(1);
}

chapter.page ??= { blocks: [] };
chapter.page.blocks ??= [];

const id = `${chapterId}-${blockType.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${chapter.page.blocks.length + 1}`;
const block = templates[blockType](id);
chapter.page.blocks.push(block);

fs.writeFileSync(lessonPath, `${JSON.stringify(lesson, null, 2)}\n`);
console.log(`✅ Added ${blockTypeArg} block to ${path.relative(root, lessonPath)} (${chapterId})`);
