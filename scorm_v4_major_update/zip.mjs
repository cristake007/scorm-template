// zip.mjs (Linux zip CLI)
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const dist = path.join(root, "dist");

if (!fs.existsSync(dist)) {
  throw new Error(`Missing dist folder at ${dist}. Run "npm run build" first.`);
}

// Copy required SCORM root files into dist (so they land at ZIP root)
fs.copyFileSync(path.join(root, "imsmanifest.xml"), path.join(dist, "imsmanifest.xml"));
fs.copyFileSync(path.join(root, "APIWrapper.js"), path.join(dist, "APIWrapper.js"));

const outZip = process.env.SCORM_ZIP_OUT
  ? path.resolve(root, process.env.SCORM_ZIP_OUT)
  : path.resolve(root, "../scorm-package.zip");

// Ensure overwrite cleanly
if (fs.existsSync(outZip)) fs.unlinkSync(outZip);

// Zip dist contents so manifest is at ZIP root
execSync(`cd "${dist}" && zip -r "${outZip}" .`, { stdio: "inherit" });

console.log(`Created ${outZip}`);