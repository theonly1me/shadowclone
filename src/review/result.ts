import { packetDiff, type ReviewPacket } from "./packet";
import { rankFindings } from "./rank";
import type { RuleHit } from "./rules";
import { reviewResultSchema, type Finding, type ReviewResult } from "./types";

function certainFinding(hit: RuleHit): Finding {
  return {
    path: hit.path,
    line: hit.line,
    severity: hit.severity,
    category: hit.category,
    source: "rule",
    title: hit.title,
    explanation: `The built-in rule \`${hit.ruleId}\` matched an added line.`,
    failureScenario: hit.failure,
    evidence: [`${hit.path}:${hit.line}`],
    rule: null,
    suggestion: null,
    refutation: "A certain built-in rule. It is reported without model judgment.",
  };
}

export function reviewResult(options: {
  readonly packet: ReviewPacket;
  readonly modelFindings: readonly Finding[];
  readonly model: string;
  readonly costUsd: number | null;
  readonly startedAt: number;
}): ReviewResult {
  const { packet } = options;
  const certainHits = packet.ruleHits.filter((hit) => hit.level === "certain");

  return reviewResultSchema.parse({
    version: 1,
    pull: packet.context.facts,
    model: options.model,
    findings: rankFindings([...certainHits.map(certainFinding), ...options.modelFindings]),
    commentableLines: Object.fromEntries(packet.context.files.map((file) => [file.path, file.ranges])),
    skippedPaths: packetDiff(packet.context.files).generated,
    toolchain: packet.toolchain.map((report) => ({
      stack: report.stack,
      tool: report.tool,
      status: report.status,
      detail: report.detail.slice(0, 1000),
      newDiagnostics: report.diagnostics.length,
    })),
    statistics: {
      modelFindings: options.modelFindings.length,
      certainRuleHits: certainHits.length,
      signalRuleHits: packet.ruleHits.length - certainHits.length,
      durationMilliseconds: Date.now() - options.startedAt,
      costUsd: options.costUsd,
    },
  });
}
