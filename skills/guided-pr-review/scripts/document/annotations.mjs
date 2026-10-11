import { escapeHtml } from "./html.mjs";

export function evidenceLinks(options) {
  return options.ids
    .map((id) => {
      const evidence = options.report.evidence.find((item) => item.id === id);
      const pull = options.report.pulls.find((item) => item.id === evidence.pr);
      const label =
        (options.report.pulls.length > 1 ? "PR #" + pull.number + " · " : "") +
        evidence.path.split("/").pop() +
        ":" +
        evidence.start;
      return (
        '<a class="evidence-link" href="#evidence-' +
        id +
        '" data-pr-link="' +
        evidence.pr +
        '" title="' +
        escapeHtml(evidence.path + ":" + evidence.start) +
        '">' +
        escapeHtml(label) +
        "</a>"
      );
    })
    .join(" ");
}

export function noteRegion(options) {
  return (
    '<div class="annotation" data-anchor="' +
    escapeHtml(options.anchor) +
    '" data-prs="' +
    escapeHtml(options.prs.join(",")) +
    '"' +
    (options.evidence ? ' data-evidence="' + escapeHtml(options.evidence) + '"' : "") +
    '><button class="quiet add-note" type="button">＋ Add note</button><div class="note-list" data-notes-for="' +
    escapeHtml(options.anchor) +
    '"></div></div>'
  );
}
