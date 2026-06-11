import { readFile } from "node:fs/promises";
import process from "node:process";

const path = process.argv[2];
if (!path) throw new Error("Usage: node scripts/analyze-terms.mjs <search-documents.json>");

const documents = JSON.parse(await readFile(path, "utf8"));
const counts = new Map();

for (const document of documents) {
  const text = Object.entries(document)
    .filter(([key]) => key !== "id")
    .map(([, value]) => value)
    .join(" ");
  for (const word of text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
}

const limit = Number(process.argv[3] ?? 100);
for (const [word, count] of [...counts].sort((a, b) => b[1] - a[1]).slice(0, limit)) {
  process.stdout.write(`${String(count).padStart(5)} ${word}\n`);
}
