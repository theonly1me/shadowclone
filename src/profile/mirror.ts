import type { MirrorReport } from "../signal";

function countedLine(label: string, count: number | string): string {
  const width = Math.max(3, 48 - label.length);
  return `    ${label} ${".".repeat(width)} ${count}`;
}

function ratioLine(options: {
  readonly label: string;
  readonly count: number;
  readonly total: number;
}): string {
  return countedLine(options.label, `${options.count} of ${options.total}`);
}

export function renderMirror(options: {
  readonly report: MirrorReport;
  readonly networkCallsMade?: boolean;
}): string {
  const report = options.report;
  const megabytes = (report.corpus.bytes / 1_048_576).toFixed(1);
  const interruptions =
    report.interruptions.length > 0
      ? report.interruptions
          .slice(0, 5)
          .map((value) => countedLine(value.label, value.count))
      : [countedLine("no interruptions indexed", 0)];
  const denials =
    report.denials.length > 0
      ? report.denials
          .slice(0, 5)
          .map((value) => countedLine(value.label, value.count))
      : [countedLine("no tool refusals indexed", 0)];
  const tools =
    report.structural.toolUses.length > 0
      ? report.structural.toolUses
          .slice(0, 5)
          .map((value) => countedLine(value.label, value.count))
      : [countedLine("no tool calls indexed", 0)];

  return [
    `  Read ${report.corpus.sessions} sessions, ${megabytes} MB, ${report.corpus.activeDays} active days.${options.networkCallsMade ? "" : " No network calls were made."}`,
    "",
    "  You stop the agent most often",
    ...interruptions,
    "",
    `  You have refused tools ${report.denials.reduce((sum, value) => sum + value.count, 0)} times`,
    ...denials,
    "",
    "  When the agent asked, you answered",
    ratioLine({
      label: "agent questions",
      count: report.answeredQuestions,
      total: report.askedQuestions,
    }),
    ratioLine({
      label: "presented plans",
      count: report.resolvedPlans,
      total: report.presentedPlans,
    }),
    "",
    "  Your most used agent tools",
    ...tools,
    "",
    "  Profile written to ~/.shadowclone/profile/.",
  ].join("\n");
}
