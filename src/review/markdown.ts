import { redactSecrets } from "../redact";
import type { Finding, ReviewResult } from "./types";

function findingSection(options: { readonly finding: Finding; readonly position: number }): string {
  const { finding } = options;
  const lines = [
    `## ${options.position}. ${finding.severity} ${finding.category}: ${finding.title}`,
    "",
    `\`${finding.path}:${finding.line}\` · source: ${finding.source}`,
    "",
    finding.explanation,
    "",
    `**Failure:** ${finding.failureScenario}`,
    ...(finding.rule ? ["", `**Rule:** ${finding.rule}`] : []),
    ...(finding.suggestion ? ["", `**Suggestion:** ${finding.suggestion}`] : []),
    "",
    `**Refuter:** ${finding.refutation}`,
    ...(finding.evidence.length > 0 ? ["", "**Evidence:**", ...finding.evidence.map((entry) => `- ${entry}`)] : []),
  ];

  return lines.join("\n");
}

function toolchainTable(result: ReviewResult): string {
  if (result.toolchain.length === 0) {
    return "No toolchain checks ran.";
  }

  const rows = result.toolchain.map(
    (entry) => `| ${entry.stack} | ${entry.tool} | ${entry.status} | ${entry.newDiagnostics} | ${entry.detail.replaceAll("|", "\\|").replaceAll("\n", " ")} |`,
  );

  return ["| Stack | Tool | Status | New diagnostics | Detail |", "| --- | --- | --- | ---: | --- |", ...rows].join("\n");
}

export function reviewMarkdown(result: ReviewResult): string {
  const { pull, statistics } = result;
  const count = result.findings.length;
  const header = [
    `# Review of ${pull.repository}#${pull.number}`,
    "",
    `Head \`${pull.headSha.slice(0, 7)}\` against \`${pull.baseRefName}\` (\`${pull.baseSha.slice(0, 7)}\`). Model ${result.model}. ${count} ${count === 1 ? "finding" : "findings"}.`,
    "",
    `The model kept ${statistics.modelFindings} ${statistics.modelFindings === 1 ? "finding" : "findings"} after refutation. Built-in rules matched ${statistics.certainRuleHits} certain and ${statistics.signalRuleHits} signal lines. The review took ${Math.round(statistics.durationMilliseconds / 1000)} seconds.`,
  ];
  const findings = count === 0 ? ["No defect survived its refuter."] : result.findings.map((finding, index) => findingSection({ finding, position: index + 1 }));
  const skipped = result.skippedPaths.length > 0 ? ["## Not reviewed", "", ...result.skippedPaths.map((skippedPath) => `- \`${skippedPath}\` (generated)`)] : [];

  return redactSecrets({
    text: [...header, "", ...findings.flatMap((section) => [section, ""]), "## Toolchain", "", toolchainTable(result), "", ...skipped].join("\n").trimEnd() + "\n",
  });
}
