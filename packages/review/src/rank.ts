import type { Finding } from "./types";

export const maximumReportedFindings = 25;

const severityOrder: Readonly<Record<Finding["severity"], number>> = {
  high: 0,
  medium: 1,
  low: 2,
};

const categoryOrder: Readonly<Record<Finding["category"], number>> = {
  security: 0,
  correctness: 1,
  performance: 2,
  tests: 3,
  standards: 4,
};

const nearbyLineDistance = 3;

function isDuplicate(options: { readonly kept: readonly Finding[]; readonly finding: Finding }): boolean {
  return options.kept.some((existing) => {
    const distance = existing.source === "rule" || options.finding.source === "rule" ? 0 : nearbyLineDistance;

    return (
      existing.path === options.finding.path &&
      existing.category === options.finding.category &&
      Math.abs(existing.line - options.finding.line) <= distance
    );
  });
}

function isKeptPastLimit(finding: Finding): boolean {
  return finding.severity === "high" || finding.source === "rule";
}

export function rankFindings(options: { readonly findings: readonly Finding[]; readonly limit: number }): readonly Finding[] {
  const sorted = [...options.findings].sort(
    (left, right) =>
      severityOrder[left.severity] - severityOrder[right.severity] ||
      categoryOrder[left.category] - categoryOrder[right.category] ||
      left.path.localeCompare(right.path) ||
      left.line - right.line,
  );
  const kept: Finding[] = [];

  for (const finding of sorted) {
    if (!isDuplicate({ kept, finding })) {
      kept.push(finding);
    }
  }

  const highSeverity = kept.filter((finding) => finding.severity === "high").length;
  const others = kept.filter((finding) => !isKeptPastLimit(finding)).slice(0, Math.max(0, options.limit - highSeverity));
  const chosen = new Set([...kept.filter(isKeptPastLimit), ...others]);

  return kept.filter((finding) => chosen.has(finding)).slice(0, maximumReportedFindings);
}
