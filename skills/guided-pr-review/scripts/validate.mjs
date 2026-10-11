import { readFile } from "node:fs/promises";
import { validateReport } from "./document/validate.mjs";

try {
  const [input] = process.argv.slice(2);
  if (!input) throw new Error("Usage: validate.mjs <review.html>");
  const html = await readFile(input, "utf8");
  const embedded = /<script type="application\/json" id="guided-review">([\s\S]*?)<\/script>/.exec(
    html,
  );
  if (!embedded) throw new Error("The document lacks its review data.");
  const report = validateReport(JSON.parse(embedded[1]));
  if (!/^[a-f0-9]{64}$/.test(report.reportId))
    throw new Error("The document lacks its pinned report identity.");
  if (/<script\b[^>]*\bsrc=/i.test(html) || /<link\b[^>]*\bhref=["']https?:/i.test(html))
    throw new Error("The document must not load remote assets.");
  for (const group of report.groups) {
    if (!html.includes('id="group-' + group.id + '"'))
      throw new Error("Missing behaviour section: " + group.id);
  }
  for (const evidence of report.evidence)
    if (evidence.text !== evidence.quote || !evidence.sha)
      throw new Error("Missing collected evidence: " + evidence.id);
  console.log(
    "validate: " +
      report.pulls.length +
      " PRs, " +
      report.groups.length +
      " groups, " +
      report.evidence.length +
      " verified excerpt records; 0 errors",
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : "Validation failed.");
  process.exitCode = 1;
}
