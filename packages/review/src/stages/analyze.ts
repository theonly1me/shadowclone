import { analyzeReview, readReviewSkill, type ReviewModel } from "../analyze";
import { checkDispositions, reviewCandidates } from "../candidates";
import { cachedFetch, type EvidenceSources } from "../evidence";
import { reviewHunks } from "../hunks";
import { type ReviewPacket, reviewPrompt } from "../packet";
import { reviewResult } from "../result";
import { linterHits } from "../rules/linters";
import { reviewParts } from "../shards";
import type { ReviewResult } from "../types";
import { reviewLensRuns } from "./lensReview";
import { inParallel } from "./parallel";
import { type PartReview, reviewPart } from "./partReview";
import type { ChecksFile, PacketFile } from "./schemas";

type CorrectionRound = ReviewResult["statistics"]["correctionRound"];

function sumCosts(costs: readonly (number | null)[]): number | null {
  const known = costs.filter((cost): cost is number => cost !== null);

  return known.length === 0 ? null : known.reduce((total, cost) => total + cost, 0);
}

function packetWithChecks(options: {
  readonly packet: PacketFile;
  readonly checks: ChecksFile | null;
}): ReviewPacket {
  const linters = linterHits({ reports: [...options.packet.reports, ...(options.checks?.reports ?? [])], files: options.packet.context.files });

  return {
    context: options.packet.context,
    ruleHits: [...options.packet.ruleHits, ...linters.hits],
    toolchain: linters.reports,
  };
}

function mergedCorrectionRound(reviews: readonly PartReview[]): CorrectionRound {
  if (reviews.some((review) => review.correctionRound === "failed")) {
    return "failed";
  }

  return reviews.some((review) => review.correctionRound === "ran") ? "ran" : "none";
}

export async function analyzeStage(options: {
  readonly packet: PacketFile;
  readonly checks: ChecksFile | null | Promise<ChecksFile | null>;
  readonly checkout: string;
  readonly reviewModel: ReviewModel;
  readonly fetchText?: (url: string) => Promise<string | null>;
}): Promise<ReviewResult> {
  const startedAt = Date.now();
  const { packet, reviewModel } = options;
  const skill = await readReviewSkill();
  const run = (request: { readonly prompt: string; readonly maxBudgetUsd: number | null }) =>
    analyzeReview({ reviewModel, checkout: options.checkout, prompt: request.prompt, maxBudgetUsd: request.maxBudgetUsd });
  const runWithoutLimit = (prompt: string) => run({ prompt, maxBudgetUsd: null });
  const firstPacket = packetWithChecks({
    packet,
    checks: options.checks instanceof Promise ? null : options.checks,
  });
  const firstParts = reviewParts({ files: packet.context.files, candidates: reviewCandidates(firstPacket) });
  const [checks, firsts] = await Promise.all([
    Promise.resolve(options.checks),
    inParallel({
      items: firstParts,
      work: (part) => runWithoutLimit(reviewPrompt({ skill, packet: firstPacket, part, focus: null })),
    }),
  ]);

  if (checks !== null && checks.headSha !== packet.context.facts.headSha) {
    throw new Error("The toolchain results belong to a different head commit.");
  }

  const reviewPacket = packetWithChecks({ packet, checks });
  const candidates = reviewCandidates(reviewPacket);
  const sources: EvidenceSources = {
    checkout: options.checkout,
    files: packet.context.files,
    ruleHits: packet.ruleHits,
    toolchain: reviewPacket.toolchain,
    fetchText: cachedFetch(options.fetchText),
  };
  const parts = reviewParts({ files: packet.context.files, candidates });
  const reviews = await inParallel({
    items: parts,
    work: async (part) => {
      const first = firsts[part.index - 1];

      if (first === undefined) {
        throw new Error(`Review part ${part.index} has no first answer.`);
      }

      return reviewPart({ part, first, skill, packet: reviewPacket, sources, run: runWithoutLimit });
    },
  });
  const lenses = await reviewLensRuns({
    parts,
    setting: reviewModel.lenses,
    spentUsd: sumCosts(reviews.flatMap((review) => review.costs)),
    skill,
    packet: reviewPacket,
    sources,
    run,
  });
  const judged = [...reviews.map((review) => review.judged), ...lenses.judged];
  const partFindings = reviews.flatMap((review) => review.analysis.findings);
  const lensFindings = lenses.judged.reduce((total, entry) => total + entry.gate.kept.length + entry.gate.dropped.length, 0);

  return reviewResult({
    packet: reviewPacket,
    modelFindings: partFindings.length + lensFindings,
    gate: { kept: judged.flatMap((entry) => entry.gate.kept), dropped: judged.flatMap((entry) => entry.gate.dropped) },
    dispositions: checkDispositions({ findings: partFindings, dropped: reviews.flatMap((review) => review.analysis.dropped), candidates }),
    candidates,
    judged: {
      refuted: judged.flatMap((entry) => entry.candidates.refuted),
      worthChecking: judged.flatMap((entry) => entry.candidates.worthChecking),
    },
    coverage: {
      hunks: parts.reduce((total, part) => total + reviewHunks(part.files).length, 0),
      uncovered: [...reviews.flatMap((review) => review.judged.coverage.missing.map((hunk) => hunk.label)), ...lenses.uncovered],
    },
    lenses: { runs: lenses.runs, skipped: lenses.skipped },
    model: reviewModel.model ?? "provider default",
    costUsd: sumCosts([...reviews.flatMap((review) => review.costs), ...lenses.costs]),
    correctionRound: mergedCorrectionRound(reviews),
    rejections: reviews.flatMap((review) => review.rejections),
    startedAt,
    parts: parts.length,
  });
}
