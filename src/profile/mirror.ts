import type { MirrorReport } from "../signal";

function countedLine(options: {
  readonly label: string;
  readonly count: number | string;
}): string {
  const width = Math.max(3, 48 - options.label.length);
  return `    ${options.label} ${".".repeat(width)} ${options.count}`;
}

function ratioLine(options: {
  readonly label: string;
  readonly count: number;
  readonly total: number;
}): string {
  return countedLine({
    label: options.label,
    count: `${options.count} of ${options.total}`,
  });
}

function countLabel(options: {
  readonly count: number;
  readonly singular: string;
  readonly plural: string;
}): string {
  return options.count === 1 ? options.singular : options.plural;
}

function resultLine(options: {
  readonly eligibleCorrectionMoments: number;
  readonly deepRulesProduced: number | undefined;
}): string {
  if (options.deepRulesProduced === undefined) {
    return options.eligibleCorrectionMoments === 0
      ? "  Profile unchanged. No correction moments are eligible for deep learning."
      : "  Profile unchanged. Run shadowclone learn --deep to distill the eligible moments.";
  }
  if (options.deepRulesProduced === 0) {
    return "  Deep learning produced no profile rules. Profile unchanged.";
  }
  const ruleLabel = countLabel({
    count: options.deepRulesProduced,
    singular: "rule",
    plural: "rules",
  });
  return [
    `  Deep learning produced ${options.deepRulesProduced} distilled profile ${ruleLabel}.`,
    "Profile updated at ~/.shadowclone/profile/.",
  ].join(" ");
}

export function renderMirror(options: {
  readonly report: MirrorReport;
  readonly deepLearningPreview: {
    readonly eligibleCorrectionMoments: number;
    readonly extractionBatches: number;
  };
  readonly networkCallsMade?: boolean;
  readonly deepRulesProduced?: number;
}): string {
  const report = options.report;
  const megabytes = (report.corpus.bytes / 1_048_576).toFixed(1);
  const corrections = report.correctionCounts;
  const correctionMomentCount =
    corrections.interruptions +
    corrections.permissionDenials +
    corrections.answeredQuestions +
    corrections.resolvedPlans;
  const interruptions =
    report.interruptions.length > 0
      ? report.interruptions
          .slice(0, 5)
          .map((value) => countedLine(value))
      : [countedLine({ label: "no interruptions indexed", count: 0 })];
  const denials =
    report.denials.length > 0
      ? report.denials
          .slice(0, 5)
          .map((value) => countedLine(value))
      : [countedLine({ label: "no tool refusals indexed", count: 0 })];
  const tools =
    report.structural.toolUses.length > 0
      ? report.structural.toolUses
          .slice(0, 5)
          .map((value) => countedLine(value))
      : [countedLine({ label: "no tool calls indexed", count: 0 })];
  const activeDayLabel = countLabel({
    count: report.corpus.activeDays,
    singular: "active day",
    plural: "active days",
  });
  const originLabel = countLabel({
    count: report.originCount,
    singular: "origin",
    plural: "origins",
  });
  const batchLabel = countLabel({
    count: options.deepLearningPreview.extractionBatches,
    singular: "extraction batch",
    plural: "extraction batches",
  });
  const sessionLabel = countLabel({
    count: report.corpus.sessions,
    singular: "session",
    plural: "sessions",
  });
  const refusalCount = corrections.permissionDenials;
  const refusalCountLabel = refusalCount === 1 ? "once" : `${refusalCount} times`;
  const networkNotice = options.networkCallsMade
    ? ""
    : " No network calls were made.";
  const corpusLine = [
    `  Read ${report.corpus.sessions} ${sessionLabel}, ${megabytes} MB,`,
    `${report.corpus.activeDays} ${activeDayLabel} across`,
    `${report.originCount} ${originLabel}.${networkNotice}`,
  ].join(" ");

  return [
    corpusLine,
    "",
    "  Correction moments found",
    countedLine({ label: "interruptions", count: corrections.interruptions }),
    countedLine({
      label: "permission denials",
      count: corrections.permissionDenials,
    }),
    countedLine({
      label: "answered questions",
      count: corrections.answeredQuestions,
    }),
    countedLine({ label: "resolved plans", count: corrections.resolvedPlans }),
    "",
    "  You stop the agent most often",
    ...interruptions,
    "",
    `  You have refused tools ${refusalCountLabel}`,
    ...denials,
    "",
    "  When the agent asked, you answered",
    ratioLine({
      label: "agent questions",
      count: corrections.answeredQuestions,
      total: report.askedQuestions,
    }),
    ratioLine({
      label: "presented plans",
      count: corrections.resolvedPlans,
      total: report.presentedPlans,
    }),
    "",
    "  Your most used agent tools",
    ...tools,
    "",
    "  Deep learning would send",
    ratioLine({
      label: "eligible correction moments",
      count: options.deepLearningPreview.eligibleCorrectionMoments,
      total: correctionMomentCount,
    }),
    countedLine({
      label: batchLabel,
      count: options.deepLearningPreview.extractionBatches,
    }),
    "",
    resultLine({
      eligibleCorrectionMoments:
        options.deepLearningPreview.eligibleCorrectionMoments,
      deepRulesProduced: options.deepRulesProduced,
    }),
  ].join("\n");
}
