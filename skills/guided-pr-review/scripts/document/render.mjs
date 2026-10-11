import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { escapeHtml, jsonForHtml } from "./html.mjs";
import { validateReport } from "./validate.mjs";
import { reportBody } from "./chrome.mjs";
import { diffRows } from "./diff.mjs";

export async function renderDocument(options) {
  const report = validateReport(options.report);
  for (const pull of report.pulls)
    if (!Array.isArray(pull.files) || !pull.mergeBaseSha)
      throw new Error("Collect Git evidence before rendering.");
  for (const pull of report.pulls)
    for (const file of pull.files) {
      file.rows = diffRows(file.diff);
      file.additions = file.rows.filter((row) => row.kind === "add").length;
      file.deletions = file.rows.filter((row) => row.kind === "remove").length;
    }
  for (const evidence of report.evidence)
    if (!evidence.text || !evidence.sha)
      throw new Error("Collect each source excerpt before rendering.");
  report.reportId = createHash("sha256")
    .update(
      JSON.stringify(
        report.pulls.map((pull) => [pull.repository, pull.number, pull.baseSha, pull.headSha]),
      ),
    )
    .digest("hex");
  const asset = async (name) => readFile(new URL("../../assets/" + name, import.meta.url), "utf8");
  const modules = [
    new URL("./html.mjs", import.meta.url),
    new URL("./markdown.mjs", import.meta.url),
    ...[
      "noteValidation",
      "state",
      "files",
      "notes",
      "navigation",
      "savedNotes",
      "actions",
      "main",
    ].map((name) => new URL("../../assets/" + name + ".mjs", import.meta.url)),
  ];
  const script = (
    await Promise.all(
      modules.map(async (url) =>
        (await readFile(url, "utf8")).replace(/^import .*;$/gm, "").replace(/^export /gm, ""),
      ),
    )
  ).join("\n");
  const replacements = {
    TITLE: escapeHtml(report.title),
    STYLE: (
      await Promise.all(
        ["theme", "layout", "readingLayout", "code", "notes", "responsive", "reading"].map((name) =>
          asset(name + ".css"),
        ),
      )
    ).join("\n"),
    BODY: reportBody(report),
    DATA: jsonForHtml(report),
  };
  const runtime = '<script type="module" id="review-runtime"></script>';
  const template = await asset("review.html");
  if (!template.includes(runtime)) throw new Error("The review template has no runtime slot.");
  return template
    .replace(/\{\{(TITLE|STYLE|BODY|DATA)\}\}/g, (_, key) => replacements[key])
    .replace(runtime, '<script type="module" id="review-runtime">' + script + "</script>");
}
