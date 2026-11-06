import type { DispositionCheck, ReviewCandidate } from "./candidates";
import type { EvidenceGate, JudgedCandidates } from "./evidence";
import { packetDiff, type ReviewPacket } from "./packet";
import { rankFindings } from "./rank";
import { findingLimit } from "./shards";
import type { RuleHit } from "./rules";
import { type Doubt, type Finding, type ReviewResult, reviewResultSchema } from "./types";

const maximumWorthChecking = 10;
const nearbyLineDistance = 3;

function isNear(options: { readonly left: { readonly path: string; readonly line: number }; readonly right: { readonly path: string; readonly line: number } }): boolean {
  return options.left.path === options.right.path && Math.abs(options.left.line - options.right.line) <= nearbyLineDistance;
}

function worthChecking(options: { readonly doubts: readonly Doubt[]; readonly findings: readonly Finding[] }): readonly Doubt[] {
  const kept: Doubt[] = [];

  for (const doubt of options.doubts) {
    const repeated = [...options.findings, ...kept].some((other) => isNear({ left: doubt, right: other }));

    if (!repeated) {
      kept.push(doubt);
    }
  }

  return kept.slice(0, maximumWorthChecking);
}

function certainFinding(hit: RuleHit): Finding {
  return {
    path: hit.path,
    line: hit.line,
    severity: hit.severity,
    category: hit.category,
    source: "rule",
    title: hit.title,
    explanation: hit.detail ?? `The built-in rule \`${hit.ruleId}\` matched an added line.`,
    failureScenario: hit.failure,
    evidence: [
      { source: "rule", location: `${hit.path}:${hit.line}`, quote: hit.ruleId },
      ...(hit.reference === undefined ? [] : [{ source: "doc" as const, location: hit.reference, quote: hit.ruleId }]),
    ],
    rule: null,
    suggestion: null,
    refutation: "A certain check. It is reported without model judgment.",
    candidates: [],
  };
}

function candidateDecisions(options: {
  readonly gate: EvidenceGate;
  readonly dispositions: DispositionCheck;
  readonly candidates: readonly ReviewCandidate[];
}) {
  const byId = new Map(options.candidates.map((candidate) => [candidate.id, candidate]));
  const lostWithFinding = options.gate.dropped.flatMap((finding) =>
    finding.candidates.flatMap((id) => {
      const candidate = byId.get(id);

      return candidate ? [{ ...candidate, reason: `its finding failed the evidence check: ${finding.reason}`.slice(0, 300) }] : [];
    }),
  );

  return {
    dropped: [...options.dispositions.dropped, ...lostWithFinding]
      .map(({ id, title, path, line, reason }) => ({ id, title, path, line, reason }))
      .slice(0, 220),
    undecided: options.dispositions.undecided.map(({ id, title, path, line }) => ({ id, title, path, line })).slice(0, 220),
  };
}

export function reviewResult(options: {
  readonly packet: ReviewPacket;
  readonly modelFindings: number;
  readonly gate: EvidenceGate;
  readonly dispositions: DispositionCheck;
  readonly candidates: readonly ReviewCandidate[];
  readonly judged: JudgedCandidates;
  readonly coverage: { readonly hunks: number; readonly uncovered: readonly string[] };
  readonly lenses: { readonly runs: number; readonly skipped: readonly string[] };
  readonly model: string;
  readonly costUsd: number | null;
  readonly correctionRound: ReviewResult["statistics"]["correctionRound"];
  readonly rejections: readonly string[];
  readonly startedAt: number;
  readonly parts: number;
}): ReviewResult {
  const { packet, gate } = options;
  const certainHits = packet.ruleHits.filter((hit) => hit.level === "certain");
  const findings = rankFindings({ findings: [...certainHits.map(certainFinding), ...gate.kept], limit: findingLimit(options.parts) });

  return reviewResultSchema.parse({
    version: 1,
    pull: packet.context.facts,
    model: options.model,
    findings,
    commentableLines: Object.fromEntries(packet.context.files.map((file) => [file.path, file.ranges])),
    skippedPaths: packetDiff(packet.context.files).generated,
    toolchain: packet.toolchain.map((report) => ({
      stack: report.stack,
      tool: report.tool,
      status: report.status,
      detail: report.detail.slice(0, 1000),
      newDiagnostics: report.diagnostics.length,
    })),
    dropped: gate.dropped.slice(0, 20).map(({ title, path, line, reason }) => ({ title, path, line, reason })),
    candidates: candidateDecisions({ gate, dispositions: options.dispositions, candidates: options.candidates }),
    rejections: options.rejections.slice(0, 50).map((rejection) => rejection.slice(0, 600)),
    worthChecking: worthChecking({ doubts: options.judged.worthChecking, findings }),
    refuted: options.judged.refuted.slice(0, 40).map(({ title, path, line, refutation }) => ({ title, path, line, refutation })),
    coverage: { hunks: options.coverage.hunks, uncovered: options.coverage.uncovered.slice(0, 50).map((label) => label.slice(0, 600)) },
    statistics: {
      modelFindings: options.modelFindings,
      droppedForEvidence: gate.dropped.length,
      correctionRound: options.correctionRound,
      certainRuleHits: certainHits.length,
      signalRuleHits: packet.ruleHits.length - certainHits.length,
      durationMilliseconds: Date.now() - options.startedAt,
      costUsd: options.costUsd,
      parts: options.parts,
      lensRuns: options.lenses.runs,
      lensesSkipped: options.lenses.skipped.slice(0, 50).map((entry) => entry.slice(0, 300)),
    },
  });
}
