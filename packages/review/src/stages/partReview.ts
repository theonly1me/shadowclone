import type { AnalysisRun } from "../analyze";
import { checkDispositions, type DispositionCheck, type ReviewCandidate } from "../candidates";
import { correctionPrompt } from "../correction";
import { checkCoverage, type CoverageCheck } from "../coverage";
import { type EvidenceGate, type EvidenceSources, gateFindings, judgeCandidates, type JudgedCandidates } from "../evidence";
import { type ReviewHunk, reviewHunks } from "../hunks";
import type { ReviewPacket } from "../packet";
import type { ReviewPart } from "../shards";
import type { Analysis, ReviewResult } from "../types";

export type Judged = {
  readonly gate: EvidenceGate;
  readonly dispositions: DispositionCheck;
  readonly coverage: CoverageCheck;
  readonly candidates: JudgedCandidates;
};

export type PartReview = {
  readonly analysis: Analysis;
  readonly judged: Judged;
  readonly costs: readonly (number | null)[];
  readonly correctionRound: ReviewResult["statistics"]["correctionRound"];
  readonly rejections: readonly string[];
};

export async function judgeAnswer(options: {
  readonly output: Analysis;
  readonly candidates: readonly ReviewCandidate[];
  readonly hunks: readonly ReviewHunk[];
  readonly sources: EvidenceSources;
}): Promise<Judged> {
  const { output, sources } = options;
  const [gate, candidates] = await Promise.all([
    gateFindings({ findings: output.findings, sources }),
    judgeCandidates({ rejected: output.rejected, unresolved: output.unresolved, sources }),
  ]);

  return {
    gate,
    candidates,
    dispositions: checkDispositions({ findings: output.findings, dropped: output.dropped, candidates: options.candidates }),
    coverage: checkCoverage({ hunks: options.hunks, coverage: output.coverage }),
  };
}

function judgedProblems(judged: Judged): readonly string[] {
  return [
    ...judged.gate.dropped.map((entry) => `Finding "${entry.title}" at ${entry.path}:${entry.line}: ${entry.reason}.`),
    ...judged.dispositions.problems,
    ...judged.coverage.problems,
  ];
}

export async function reviewPart(options: {
  readonly part: ReviewPart;
  readonly first: AnalysisRun;
  readonly skill: string;
  readonly packet: ReviewPacket;
  readonly sources: EvidenceSources;
  readonly run: (prompt: string) => Promise<AnalysisRun>;
}): Promise<PartReview> {
  const { part, first } = options;
  const hunks = reviewHunks(part.files);
  const judge = (output: Analysis) => judgeAnswer({ output, candidates: part.candidates, hunks, sources: options.sources });
  const firstJudged = await judge(first.output);
  const problems = judgedProblems(firstJudged);
  const second =
    problems.length === 0
      ? null
      : await options
          .run(correctionPrompt({ skill: options.skill, packet: options.packet, part, previous: first.output, rejections: problems }))
          .catch(() => "failed" as const);

  if (second === null || second === "failed") {
    return {
      analysis: first.output,
      judged: firstJudged,
      costs: [first.costUsd],
      correctionRound: second === null ? "none" : "failed",
      rejections: problems,
    };
  }

  return {
    analysis: second.output,
    judged: await judge(second.output),
    costs: [first.costUsd, second.costUsd],
    correctionRound: "ran",
    rejections: problems,
  };
}
