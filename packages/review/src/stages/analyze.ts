import { analyzeReview, readReviewSkill, type ReviewModel } from "../analyze";
import {
  checkDispositions,
  type DispositionCheck,
  type ReviewCandidate,
  reviewCandidates,
} from "../candidates";
import { correctionPrompt } from "../correction";
import { cachedFetch, type EvidenceGate, gateFindings } from "../evidence";
import { type ReviewPacket, reviewPrompt } from "../packet";
import { reviewResult } from "../result";
import { linterHits } from "../rules/linters";
import { maximumParallelParts, type ReviewPart, reviewParts } from "../shards";
import type { Analysis, ReviewResult } from "../types";
import type { ChecksFile, PacketFile } from "./schemas";

type Judged = { readonly gate: EvidenceGate; readonly dispositions: DispositionCheck };

type CorrectionRound = ReviewResult["statistics"]["correctionRound"];

type PartReview = {
  readonly analysis: Analysis;
  readonly gate: EvidenceGate;
  readonly costs: readonly (number | null)[];
  readonly correctionRound: CorrectionRound;
  readonly rejections: readonly string[];
};

function sumCosts(costs: readonly (number | null)[]): number | null {
  const known = costs.filter((cost): cost is number => cost !== null);

  return known.length === 0 ? null : known.reduce((total, cost) => total + cost, 0);
}

function rejections(judged: Judged): readonly string[] {
  return [
    ...judged.gate.dropped.map(
      (entry) => `Finding "${entry.title}" at ${entry.path}:${entry.line}: ${entry.reason}.`,
    ),
    ...judged.dispositions.problems,
  ];
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

async function eachPart<Output>(options: {
  readonly parts: readonly ReviewPart[];
  readonly work: (part: ReviewPart) => Promise<Output>;
}): Promise<readonly Output[]> {
  const results: Output[] = [];
  const queue = [...options.parts];
  const worker = async (): Promise<void> => {
    for (let part = queue.shift(); part !== undefined; part = queue.shift()) {
      results[part.index - 1] = await options.work(part);
    }
  };

  await Promise.all(Array.from({ length: Math.min(maximumParallelParts, queue.length) }, worker));
  return results;
}

export async function analyzeStage(options: {
  readonly packet: PacketFile;
  readonly checks: ChecksFile | null | Promise<ChecksFile | null>;
  readonly checkout: string;
  readonly reviewModel: ReviewModel;
  readonly fetchText?: (url: string) => Promise<string | null>;
}): Promise<ReviewResult> {
  const startedAt = Date.now();
  const { packet } = options;
  const skill = await readReviewSkill();
  const run = (prompt: string) =>
    analyzeReview({ reviewModel: options.reviewModel, checkout: options.checkout, prompt });
  const firstPacket = packetWithChecks({
    packet,
    checks: options.checks instanceof Promise ? null : options.checks,
  });
  const firstParts = reviewParts({
    files: packet.context.files,
    candidates: reviewCandidates(firstPacket),
  });
  const [checks, firsts] = await Promise.all([
    Promise.resolve(options.checks),
    eachPart({
      parts: firstParts,
      work: (part) => run(reviewPrompt({ skill, packet: firstPacket, part })),
    }),
  ]);

  if (checks !== null && checks.headSha !== packet.context.facts.headSha) {
    throw new Error("The toolchain results belong to a different head commit.");
  }

  const reviewPacket = packetWithChecks({ packet, checks });
  const candidates = reviewCandidates(reviewPacket);
  const fetchText = cachedFetch(options.fetchText);
  const judge = async (judged: {
    readonly output: Analysis;
    readonly candidates: readonly ReviewCandidate[];
  }): Promise<Judged> => ({
    gate: await gateFindings({
      findings: judged.output.findings,
      sources: {
        checkout: options.checkout,
        files: packet.context.files,
        ruleHits: packet.ruleHits,
        toolchain: reviewPacket.toolchain,
        fetchText,
      },
    }),
    dispositions: checkDispositions({
      findings: judged.output.findings,
      dropped: judged.output.dropped,
      candidates: judged.candidates,
    }),
  });
  const review = async (part: ReviewPart): Promise<PartReview> => {
    const first = firsts[part.index - 1];

    if (first === undefined) {
      throw new Error(`Review part ${part.index} has no first answer.`);
    }

    const firstJudged = await judge({ output: first.output, candidates: part.candidates });
    const problems = rejections(firstJudged);
    const second =
      problems.length === 0
        ? null
        : await run(
            correctionPrompt({
              skill,
              packet: reviewPacket,
              part,
              previous: first.output,
              rejections: problems,
            }),
          ).catch(() => "failed" as const);
    const final =
      second === null || second === "failed"
        ? { output: first.output, judged: firstJudged }
        : {
            output: second.output,
            judged: await judge({ output: second.output, candidates: part.candidates }),
          };

    return {
      analysis: final.output,
      gate: final.judged.gate,
      costs: [first.costUsd, ...(second !== null && second !== "failed" ? [second.costUsd] : [])],
      correctionRound: second === null ? "none" : second === "failed" ? "failed" : "ran",
      rejections: problems,
    };
  };
  const parts = reviewParts({ files: packet.context.files, candidates });
  const reviews = await eachPart({ parts, work: review });
  const analysis: Analysis = {
    findings: reviews.flatMap((partReview) => partReview.analysis.findings),
    dropped: reviews.flatMap((partReview) => partReview.analysis.dropped),
  };

  return reviewResult({
    packet: reviewPacket,
    analysis,
    gate: {
      kept: reviews.flatMap((partReview) => partReview.gate.kept),
      dropped: reviews.flatMap((partReview) => partReview.gate.dropped),
    },
    dispositions: checkDispositions({
      findings: analysis.findings,
      dropped: analysis.dropped,
      candidates,
    }),
    candidates,
    model: options.reviewModel.model,
    costUsd: sumCosts(reviews.flatMap((partReview) => partReview.costs)),
    correctionRound: mergedCorrectionRound(reviews),
    rejections: reviews.flatMap((partReview) => partReview.rejections),
    startedAt,
    parts: parts.length,
  });
}
