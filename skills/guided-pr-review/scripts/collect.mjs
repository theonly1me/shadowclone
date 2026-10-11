import { readFile } from "node:fs/promises";
import { collectReport } from "./evidence/collect.mjs";
import { writeArtifact } from "./document/write.mjs";

try {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error("Usage: collect.mjs <input.json> <report.json>");
  const report = collectReport(JSON.parse(await readFile(input, "utf8")));
  await writeArtifact({ path: output, content: JSON.stringify(report) });
  console.log(
    "collect: " +
      report.pulls.length +
      " PRs, " +
      report.pulls.reduce((count, pull) => count + pull.files.length, 0) +
      " changed files, " +
      report.evidence.length +
      " verified excerpts",
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : "Collection failed.");
  process.exitCode = 1;
}
