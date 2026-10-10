import type { DiffFile } from "../collect";
import type { CommandReport, Diagnostic } from "../toolchain";
import type { RuleHit } from "./types";

const reportedLinters: Readonly<Record<string, RuleHit["category"]>> = {
  shellcheck: "correctness",
  hadolint: "correctness",
  actionlint: "correctness",
  zizmor: "security",
  squawk: "correctness",
  trivy: "security",
};

const advisoryOnly = /^(?:\S+\s+)?(?:info|note|style)\b/i;

function isReported(diagnostic: Diagnostic): boolean {
  return Object.hasOwn(reportedLinters, diagnostic.tool) && !advisoryOnly.test(diagnostic.message);
}

const severityRank: Readonly<Record<RuleHit["severity"], number>> = { high: 0, medium: 1, low: 2 };

function severity(message: string): RuleHit["severity"] {
  if (/^(?:CRITICAL|HIGH)\b/.test(message)) {
    return "high";
  }

  return /^MEDIUM\b|\berror\b/i.test(message) ? "medium" : "low";
}

function lineHit(diagnostics: readonly Diagnostic[]): RuleHit[] {
  const ordered = [...diagnostics].sort(
    (left, right) => severityRank[severity(left.message)] - severityRank[severity(right.message)],
  );
  const [first] = ordered;

  if (first === undefined) {
    return [];
  }

  const messages = ordered.map((diagnostic) => diagnostic.message);

  return [
    {
      ruleId: first.tool,
      level: "certain",
      severity: severity(first.message),
      category: reportedLinters[first.tool] ?? "correctness",
      title: `${first.tool}: ${first.message}`.slice(0, 100),
      failure: messages.join(" ").slice(0, 300),
      path: first.path,
      line: first.line,
      detail: `${first.tool} reports ${messages.length === 1 ? "this problem" : `${messages.length} problems`} in the change at this line.`,
    },
  ];
}

function anchored(options: {
  readonly diagnostic: Diagnostic;
  readonly files: readonly DiffFile[];
}): Diagnostic {
  const { diagnostic } = options;
  const added = options.files.find((file) => file.path === diagnostic.path)?.added ?? [];
  const lastAdded = added.reduce((last, line) => Math.max(last, line.line), 0);

  return diagnostic.fileLevel === true && lastAdded > 0
    ? { ...diagnostic, line: lastAdded }
    : diagnostic;
}

export function linterHits(options: {
  readonly reports: readonly CommandReport[];
  readonly files: readonly DiffFile[];
}): {
  readonly hits: readonly RuleHit[];
  readonly reports: readonly CommandReport[];
} {
  const { reports } = options;
  const byLine = new Map<string, Diagnostic[]>();
  const reported = reports
    .flatMap((report) => report.diagnostics)
    .filter(isReported)
    .map((diagnostic) => anchored({ diagnostic, files: options.files }));

  for (const diagnostic of reported) {
    const key = `${diagnostic.tool}\n${diagnostic.path}\n${diagnostic.line}`;
    byLine.set(key, [...(byLine.get(key) ?? []), diagnostic]);
  }

  return {
    hits: [...byLine.values()].flatMap(lineHit),
    reports: reports.map((report) => ({
      ...report,
      diagnostics: report.diagnostics.filter((diagnostic) => !isReported(diagnostic)),
    })),
  };
}
