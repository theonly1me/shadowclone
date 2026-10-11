import { escapeHtml } from "./html.mjs";
import { renderMarkdown } from "./markdown.mjs";
import { groupSection, fileCard } from "./sections.mjs";

function pullTabs(report) {
  if (report.pulls.length < 2) return "";
  return (
    '<nav class="tabs" aria-label="Filter the guide by PR"><button type="button" data-pr-tab="stack" aria-pressed="true">All PRs</button>' +
    report.pulls
      .map(
        (pull) =>
          '<button type="button" data-pr-tab="' +
          pull.id +
          '" aria-pressed="false">PR #' +
          pull.number +
          "<small>" +
          escapeHtml(pull.title) +
          "</small></button>",
      )
      .join("") +
    '</nav><p class="muted filter-help">PR filters keep related steps together. Each diff identifies its own PR.</p>'
  );
}

function reportDetails(report) {
  const summaries = report.pulls
    .map(
      (pull) =>
        '<div class="pr-summary" data-pr="' +
        pull.id +
        '"><a href="' +
        pull.url +
        '" target="_blank" rel="noreferrer">PR #' +
        pull.number +
        ": " +
        escapeHtml(pull.title) +
        '</a><p class="muted">Head <code>' +
        pull.headSha.slice(0, 12) +
        "</code> · base <code>" +
        pull.baseSha.slice(0, 12) +
        "</code> · " +
        pull.files.length +
        " changed files</p>" +
        (pull.ci ?? [])
          .map(
            (check) =>
              '<span class="badge">' +
              escapeHtml(check.name) +
              ": " +
              escapeHtml(check.status) +
              "</span> ",
          )
          .join("") +
        "</div>",
    )
    .join("");
  const inventoryStatus = report.pulls.flatMap((pull) =>
    pull.files.map(
      (file) =>
        report.coverage.find((item) => item.pr === pull.id && item.path === file.path)?.status ??
        "unexamined",
    ),
  );
  const coverage = ["reviewed", "generated", "unexamined"]
    .map((status) => inventoryStatus.filter((item) => item === status).length + " " + status)
    .join(" · ");
  const inheritance =
    report.pulls.length < 2
      ? ""
      : '<p class="muted">' +
        (report.stackEdges.length
          ? "Inherited changes: " +
            report.stackEdges.map((edge) => escapeHtml(edge.from + " → " + edge.to)).join(" · ")
          : "The supplied PRs have no established inheritance.") +
        '</p><p class="muted">' +
        (report.combinedHead
          ? "Combined head: " + report.combinedHead.slice(0, 12)
          : "No combined head exists. Cross-PR scenarios remain separate.") +
        "</p>";
  return (
    '<details id="report-details"><summary>PR details and CI</summary>' +
    '<p class="muted">Investigation coverage: ' +
    coverage +
    "</p>" +
    summaries +
    inheritance +
    '<p class="muted">Generated ' +
    escapeHtml(report.generatedAt) +
    "</p></details>"
  );
}

function notesPanel(report) {
  const options = report.pulls
    .map(
      (pull) =>
        '<option value="' +
        pull.id +
        '">PR #' +
        pull.number +
        ": " +
        escapeHtml(pull.title) +
        "</option>",
    )
    .join("");
  return (
    '<section id="notes-panel" hidden><button type="button" id="back-to-guide">Back to guide</button><h2>Your review notes</h2><p>Compare your mental notes or draft PR comments with the agent proposals when you are ready.</p><div class="toolbar"><button type="button" id="compare-proposals">Compare agent proposals</button><button type="button" id="save-notes">Save notes</button><button type="button" id="export-notes">Export notes</button><button type="button" id="import-notes">Import notes</button><input type="file" accept="application/json" id="notes-file" hidden></div><div id="all-notes"></div><div class="draft-controls"><label>Draft for <select id="draft-pr">' +
    options +
    '</select></label><span id="selected-count">0 selected</span><button id="stage-review" type="button" class="primary" disabled>Leave draft review on PR</button><a id="draft-link" hidden target="_blank" rel="noreferrer"></a></div><p id="action-status" role="status">Opening the guide makes no model request or GitHub write.</p></section>'
  );
}

export function reportBody(report) {
  const route = report.groups
    .map(
      (group, index) =>
        '<li data-prs="' +
        group.prs.join(",") +
        '"><a href="#group-' +
        group.id +
        '" data-guide-step="' +
        group.id +
        '"><span class="route-number">' +
        (index + 1) +
        "</span><span>" +
        escapeHtml(group.title) +
        "<small>" +
        group.prs
          .map((id) => "PR #" + report.pulls.find((pull) => pull.id === id).number)
          .join(" + ") +
        "</small></span></a></li>",
    )
    .join("");
  const files = report.pulls.reduce((count, pull) => count + pull.files.length, 0);
  const inventory = report.pulls
    .map(
      (pull) =>
        '<div class="inventory-pr" data-pr="' +
        pull.id +
        '"><h3>PR #' +
        pull.number +
        " · " +
        pull.files.length +
        " files</h3>" +
        pull.files.map((file) => fileCard({ report, pr: pull.id, path: file.path })).join("") +
        "</div>",
    )
    .join("");
  const title =
    report.pulls.length === 1 ? "PR #" + report.pulls[0].number : report.pulls.length + " PRs";
  return (
    '<header class="masthead"><div class="brand"><span>◈</span>shadowclone <span class="muted">/ guided review</span></div><div class="toolbar"><button type="button" id="toggle-theme" aria-label="Switch color theme">Theme</button><button type="button" id="review-notes">Review notes <span id="notes-count">0</span></button></div></header><div class="layout"><aside><span class="eyebrow">READING ORDER</span><p id="route-progress" class="muted">0 of ' +
    report.groups.length +
    ' steps reviewed</p><input id="guide-search" class="sidebar-search" type="search" placeholder="Find a step" aria-label="Search the reading order"><ol class="route">' +
    route +
    '</ol><p class="muted">Read the code. Add your notes. Then compare the agent proposals.</p></aside><main><div id="guide-intro"><div class="report-heading"><span class="eyebrow">' +
    title +
    " · " +
    files +
    " CHANGED FILES</span><h1>" +
    escapeHtml(report.title) +
    "</h1>" +
    renderMarkdown(report.summary) +
    "</div>" +
    pullTabs(report) +
    reportDetails(report) +
    "</div>" +
    report.groups.map((group, index) => groupSection({ report, group, index })).join("") +
    notesPanel(report) +
    '<section id="additional-notes" hidden></section><details id="file-inventory"><summary>All changed files (' +
    files +
    ")</summary>" +
    inventory +
    "</details></main></div>"
  );
}
