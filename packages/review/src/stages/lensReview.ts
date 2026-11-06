import type { AnalysisRun, ReviewLensSetting } from "../analyze";
import type { EvidenceSources } from "../evidence";
import { type ReviewHunk, reviewHunks } from "../hunks";
import { lensAssignments, type ReviewLens } from "../lenses";
import { type ReviewPacket, reviewPrompt } from "../packet";
import type { ReviewPart } from "../shards";
import { inParallel } from "./parallel";
import { judgeAnswer, type Judged } from "./partReview";

export const minimumLensBudgetUsd = 0.1;

export type LensReview = {
  readonly judged: readonly Judged[];
  readonly costs: readonly (number | null)[];
  readonly runs: number;
  readonly skipped: readonly string[];
  readonly uncovered: readonly string[];
};

type LensJob = {
  readonly part: ReviewPart;
  readonly lens: ReviewLens;
  readonly hunks: readonly ReviewHunk[];
};

type LensBudget =
  | { readonly kind: "unlimited" }
  | { readonly kind: "limited"; readonly perRunUsd: number }
  | { readonly kind: "spent"; readonly reason: string };

type LensOutcome =
  | { readonly kind: "ran"; readonly job: LensJob; readonly answer: AnalysisRun; readonly judged: Judged }
  | { readonly kind: "failed"; readonly job: LensJob; readonly reason: string };

const noLensReview: LensReview = { judged: [], costs: [], runs: 0, skipped: [], uncovered: [] };

function jobName(job: LensJob): string {
  return job.part.total === 1 ? job.lens.title : `${job.lens.title} on part ${job.part.index}`;
}

function lensBudget(options: {
  readonly maxCostUsd: number | null;
  readonly spentUsd: number | null;
  readonly runs: number;
}): LensBudget {
  if (options.maxCostUsd === null || options.spentUsd === null) {
    return { kind: "unlimited" };
  }

  const perRunUsd = (options.maxCostUsd - options.spentUsd) / Math.max(1, options.runs);

  return perRunUsd >= minimumLensBudgetUsd
    ? { kind: "limited", perRunUsd }
    : {
        kind: "spent",
        reason: `the part runs used $${options.spentUsd.toFixed(2)} of the $${options.maxCostUsd.toFixed(2)} limit`,
      };
}

export async function reviewLensRuns(options: {
  readonly parts: readonly ReviewPart[];
  readonly setting: ReviewLensSetting;
  readonly spentUsd: number | null;
  readonly skill: string;
  readonly packet: ReviewPacket;
  readonly sources: EvidenceSources;
  readonly run: (request: { readonly prompt: string; readonly maxBudgetUsd: number | null }) => Promise<AnalysisRun>;
}): Promise<LensReview> {
  if (!options.setting.enabled) {
    return noLensReview;
  }

  const jobs = options.parts.flatMap((part) =>
    lensAssignments(reviewHunks(part.files)).map((assignment) => ({ part, ...assignment })),
  );
  const budget = lensBudget({ maxCostUsd: options.setting.maxCostUsd, spentUsd: options.spentUsd, runs: jobs.length });

  if (budget.kind === "spent") {
    return { ...noLensReview, skipped: jobs.map((job) => `${jobName(job)}: ${budget.reason}`) };
  }

  const maxBudgetUsd = budget.kind === "limited" ? budget.perRunUsd : null;
  const outcomes = await inParallel({
    items: jobs,
    work: async (job): Promise<LensOutcome> => {
      const prompt = reviewPrompt({ skill: options.skill, packet: options.packet, part: job.part, focus: { lens: job.lens, hunks: job.hunks } });

      try {
        const answer = await options.run({ prompt, maxBudgetUsd });
        const judged = await judgeAnswer({ output: answer.output, candidates: [], hunks: job.hunks, sources: options.sources });

        return { kind: "ran", job, answer, judged };
      } catch (error) {
        return { kind: "failed", job, reason: error instanceof Error ? error.message : String(error) };
      }
    },
  });
  const ran = outcomes.filter((outcome) => outcome.kind === "ran");

  return {
    judged: ran.map((outcome) => outcome.judged),
    costs: ran.map((outcome) => outcome.answer.costUsd),
    runs: ran.length,
    skipped: outcomes.flatMap((outcome) => (outcome.kind === "failed" ? [`${jobName(outcome.job)}: ${outcome.reason}`] : [])),
    uncovered: ran.flatMap((outcome) =>
      outcome.judged.coverage.missing.map((hunk) => `${jobName(outcome.job)}: ${hunk.label}`),
    ),
  };
}
