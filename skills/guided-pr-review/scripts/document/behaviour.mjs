import { escapeHtml, sourceUrl } from "./html.mjs";
import { evidenceLinks, noteRegion } from "./annotations.mjs";

export function evidenceCard(options) {
  const evidence = options.report.evidence.find((item) => item.id === options.id);
  const pull = options.report.pulls.find((item) => item.id === evidence.pr);
  const url = sourceUrl({
    repository: pull.repository,
    sha: evidence.sha,
    path: evidence.path,
    start: evidence.start,
    end: evidence.end,
  });
  const lines = evidence.text
    .split("\n")
    .map(
      (text, index) =>
        '<div class="source-line"><span class="line-number">' +
        (evidence.start + index) +
        "</span><code>" +
        escapeHtml(text) +
        "</code></div>",
    )
    .join("");
  return (
    '<details class="evidence" id="evidence-' +
    evidence.id +
    '"><summary>' +
    escapeHtml(evidence.pr) +
    " · " +
    escapeHtml(evidence.path) +
    ":" +
    evidence.start +
    " · " +
    evidence.side +
    '</summary><a class="source-link" href="' +
    escapeHtml(url) +
    '" target="_blank" rel="noreferrer">Open source at ' +
    escapeHtml(evidence.sha.slice(0, 7)) +
    '</a><div class="source-code">' +
    lines +
    "</div>" +
    noteRegion({ anchor: "evidence-" + evidence.id, prs: [evidence.pr], evidence: evidence.id }) +
    "</details>"
  );
}

export function diagramCard(options) {
  const { diagram } = options.group;
  if (!diagram.nodes.length) return "";
  const node = (item) =>
    '<div class="flow-node"><b>' +
    escapeHtml(item.label) +
    "</b>" +
    evidenceLinks({ report: options.report, ids: item.evidence }) +
    "</div>";
  if (!diagram.edges.length)
    return '<div class="flow-nodes">' + diagram.nodes.map(node).join("") + "</div>";
  return (
    '<div class="flow-transitions" aria-label="Code flow">' +
    diagram.edges
      .map((edge) => {
        const from = diagram.nodes.find((item) => item.id === edge.from);
        const to = diagram.nodes.find((item) => item.id === edge.to);
        return (
          '<div class="flow-transition">' +
          node(from) +
          '<div class="flow-condition"><span aria-label="then">→</span><b>' +
          escapeHtml(edge.label) +
          "</b>" +
          evidenceLinks({ report: options.report, ids: edge.evidence }) +
          "</div>" +
          node(to) +
          "</div>"
        );
      })
      .join("") +
    "</div>"
  );
}

export function dryRuns(options) {
  return options.group.dryRuns
    .map(
      (run) =>
        '<details class="dry-run"><summary>' +
        escapeHtml(run.title) +
        ' <span class="badge">' +
        run.kind +
        "</span></summary><p><b>Input:</b> " +
        escapeHtml(run.input) +
        "</p>" +
        (run.kind === "executed" ? "<pre><code>" + escapeHtml(run.command) + "</code></pre>" : "") +
        '<div class="table-scroll"><table><thead><tr><th>Branch</th><th>State</th><th>Side effects</th><th>Outcome and evidence</th></tr></thead><tbody>' +
        run.steps
          .map(
            (step) =>
              "<tr><td>" +
              escapeHtml(step.branch) +
              "</td><td>" +
              escapeHtml(step.state) +
              "</td><td>" +
              escapeHtml(step.effects) +
              "</td><td>" +
              escapeHtml(step.outcome) +
              evidenceLinks({ report: options.report, ids: step.evidence }) +
              "</td></tr>",
          )
          .join("") +
        "</tbody></table></div><p><b>Result:</b> " +
        escapeHtml(run.outcome) +
        "</p></details>",
    )
    .join("");
}
