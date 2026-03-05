import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../src/', import.meta.url);
const exts = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.vue', '.json', '.css', '.scss', '.html']);
const markers = ['<<<<<<<', '=======', '>>>>>>>'];

async function walk(dirUrl, out = []) {
  const dirPath = fileURLToPath(dirUrl);
  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await walk(new URL(`${entry.name}/`, dirUrl), out);
      continue;
    }
    if (!exts.has(path.extname(entry.name))) continue;
    out.push(abs);
  }
  return out;
}

const files = await walk(ROOT);
const conflicts = [];

for (const file of files) {
  const txt = await readFile(file, 'utf8');
  const lines = txt.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (markers.some((m) => line.includes(m))) {
      conflicts.push(`${path.relative(process.cwd(), file)}:${i + 1}: ${line.trim()}`);
    }
  });
}

if (conflicts.length) {
  console.error('❌ Merge conflict markers detected:');
  for (const c of conflicts) console.error(`  - ${c}`);
  process.exit(1);
}

console.log(`✅ No merge conflict markers found (${files.length} files scanned)`);
