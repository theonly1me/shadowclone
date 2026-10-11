import { readFile } from "node:fs/promises";
import { renderDocument } from "./document/render.mjs";
import { writeArtifact } from "./document/write.mjs";

try {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error("Usage: render.mjs <report.json> <review.html>");
  const report = JSON.parse(await readFile(input, "utf8"));
  const html = await renderDocument({ report });
  await writeArtifact({ path: output, content: html });
  console.log(
    "render: " +
      report.pulls.length +
      " PRs, " +
      report.groups.length +
      " behaviour groups, " +
      report.proposals.length +
      " agent proposals",
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : "Rendering failed.");
  process.exitCode = 1;
}
