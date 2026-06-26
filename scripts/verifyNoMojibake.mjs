import { readFile } from "node:fs/promises";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SKIP_DIRS = new Set(["node_modules", ".expo", ".git"]);
const SKIP_FILES = new Set(["package-lock.json", "wait-samples-local.json", "wait-analysis-local.json"]);
const TARGET_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".md", ".sql"]);
const MOJIBAKE_TOKENS = [
  "\\uFFFD",
  "\\u7E67",
  "\\u7E5D",
  "\\u879F",
  "\\u8B41",
  "\\u8373",
  "\\u90B1",
  "\\u8B17",
  "\\u7E3A",
  "\\u7B0F",
  "\\u7AB6",
  "\\uFF82",
  "\\u9A55",
  "\\u86FB",
  "\\u9695",
  "\\u83EB",
  "\\u873F",
  "\\u8B5B",
  "\\u9B1F",
  "\\u8815",
  "\\u4FE3",
  "\\u9AE2",
  "\\u72D7",
  "\\u5331",
];
const MOJIBAKE_PATTERN = new RegExp(MOJIBAKE_TOKENS.join("|"), "g");

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        files.push(...walk(path.join(dir, entry.name)));
      }
      continue;
    }
    if (!entry.isFile()) continue;
    if (SKIP_FILES.has(entry.name)) continue;
    const ext = path.extname(entry.name);
    if (TARGET_EXTENSIONS.has(ext)) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

const findings = [];
for (const file of walk(ROOT)) {
  if (statSync(file).size > 2_000_000) continue;
  const text = await readFile(file, "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (MOJIBAKE_PATTERN.test(line)) {
      findings.push({
        file: path.relative(ROOT, file),
        line: index + 1,
        text: line.trim().slice(0, 160),
      });
    }
    MOJIBAKE_PATTERN.lastIndex = 0;
  });
}

if (findings.length > 0) {
  console.error(JSON.stringify(findings, null, 2));
  process.exitCode = 1;
} else {
  console.log("No mojibake patterns found.");
}
