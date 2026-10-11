import { escapeHtml } from "./html.mjs";
import { renderMarkdown } from "./markdown.mjs";
import { evidenceLinks, noteRegion } from "./annotations.mjs";
import { evidenceCard, diagramCard, dryRuns } from "./behaviour.mjs";

export function fileCard(options) {
  const pull = options.report.pulls.find((item) => item.id === options.pr);
  const index = pull.files.findIndex((file) => file.path === options.path);
  const file = pull.files[index];
  const coverage = options.report.coverage.find(
    (item) => item.pr === pull.id && item.path === file.path,
  );
  return (
    '<details class="file-card" data-file-pr="' +
    pull.id +
    '" data-file-index="' +
    index +
    (options.open ? '" open' : '"') +
    (options.focus ? ' data-focus-line="' + options.focus + '"' : "") +
    '><summary><span class="badge">' +
    "PR #" +
    pull.number +
    "</span> <code>" +
    escapeHtml(file.path) +
    '</code><span class="file-count">+' +
    file.additions +
    " / -" +
    file.deletions +
    " · " +
    escapeHtml(coverage?.status ?? "unexamined") +
    '</span></summary><p class="muted">' +
    escapeHtml(coverage?.reason ?? "No investigation record was supplied for this file.") +
    '</p><div class="file-controls"><button data-file-view="diff" type="button">Diff</button><button data-file-view="base" type="button">Base' +
    (/\.md$/i.test(file.path) ? " Markdown" : " source") +
    '</button><button data-file-view="head" type="button">Head' +
    (/\.md$/i.test(file.path) ? " Markdown" : " source") +
    '</button></div><div class="file-content"></div></details>'
  );
}

export function groupSection(options) {
  const { group, report, index } = options;
  const pairedFiles = new Set();
  const steps = group.steps
    .map((step, stepIndex) => {
      const excerpts = step.evidence.map((id) => report.evidence.find((item) => item.id === id));
      const changes = excerpts.filter((item) =>
        report.pulls
          .find((pull) => pull.id === item.pr)
          .files.some((file) => file.path === item.path),
      );
      const files = changes
        .filter((item) => {
          const key = item.pr + ":" + item.path;
          if (pairedFiles.has(key)) return false;
          pairedFiles.add(key);
          return true;
        })
        .map((item) =>
          fileCard({
            report,
            pr: item.pr,
            path: item.path,
            open: stepIndex === 0,
            focus: item.start,
          }),
        )
        .join("");
      return (
        "<li><h3>" +
        escapeHtml(step.title) +
        "</h3>" +
        renderMarkdown(step.text) +
        evidenceLinks({ report, ids: step.evidence }) +
        files +
        noteRegion({
          anchor: "step-" + group.id + "-" + stepIndex,
          prs: group.prs,
          evidence: step.evidence[0],
        }) +
        "</li>"
      );
    })
    .join("");
  const remaining = group.files.filter((file) => !pairedFiles.has(file.pr + ":" + file.path));
  const files = remaining.length
    ? "<h3>Related changes</h3>" + remaining.map((file) => fileCard({ report, ...file })).join("")
    : "";
  return (
    '<section hidden class="group-section" id="group-' +
    group.id +
    '" data-group="' +
    group.id +
    '" data-prs="' +
    group.prs.join(",") +
    '"><div class="group-top"><span class="eyebrow">READING STEP ' +
    (index + 1) +
    " OF " +
    report.groups.length +
    " · " +
    group.prs.map((id) => "PR #" + report.pulls.find((pull) => pull.id === id).number).join(" + ") +
    '</span><label class="complete-label"><input type="checkbox" data-progress="' +
    group.id +
    '"> Reviewed</label></div><h2 tabindex="-1">' +
    escapeHtml(group.title) +
    '</h2><div class="group-intro">' +
    renderMarkdown(group.summary) +
    '</div><p class="why"><b>Why it matters.</b> ' +
    escapeHtml(group.why) +
    '</p><div class="before-after"><div><span class="eyebrow">BEFORE</span>' +
    renderMarkdown(group.before) +
    '</div><div><span class="eyebrow">AFTER</span>' +
    renderMarkdown(group.after) +
    "</div></div>" +
    diagramCard(options) +
    '<ol class="reading-steps">' +
    steps +
    "</ol>" +
    noteRegion({ anchor: "group-" + group.id, prs: group.prs }) +
    '<div class="agent-proposals" data-proposals-for="' +
    group.id +
    '" hidden></div>' +
    dryRuns(options) +
    files +
    "<details><summary>Surrounding code and evidence</summary>" +
    group.evidence.map((id) => evidenceCard({ report, id })).join("") +
    '</details><div class="step-navigation"><button type="button" data-step-move="-1" disabled>First step</button><button type="button" data-step-move="1" disabled>Last step</button></div><button type="button" class="quiet open-notes">Review your notes and compare proposals</button></section>'
  );
}
