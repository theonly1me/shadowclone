import type { AnalysisRun, ReviewLensSetting } from "../analyze";
import type { DiffFile } from "../collect";
import type { EvidenceSources } from "../evidence";
import { type ReviewHunk, reviewHunks } from "../hunks";
import { lensAssignments, type ReviewLens } from "../lenses";
import { type ReviewPacket, reviewPrompt } from "../packet";
import { maximumPartBytes, type ReviewPart } from "../shards";
import { judgeAnswer, type Judged } from "./partReview";

const minimumLensBudgetUsd = 0.25;

export type LensReview = {
  readonly judged: readonly Judged[];
  readonly costs: readonly (number | null)[];
  readonly runs: number;
  readonly skipped: readonly string[];
  readonly uncovered: readonly string[];
};

type LensJob = {
  readonly lens: ReviewLens;
  readonly part: ReviewPart;
  readonly hunks: readonly ReviewHunk[];
};

const noLensReview: LensReview = { judged: [], costs: [], runs: 0, skipped: [], uncovered: [] };

function filesForLens(options: { readonly lens: ReviewLens; readonly files: readonly DiffFile[] }): readonly DiffFile[] {
  const ranked = options.files
    .map((file) => ({ file, matched: lensAssignments(reviewHunks([file])).find((entry) => entry.lens.id === options.lens.id)?.hunks.length ?? 0 }))
    .filter((entry) => entry.matched > 0)
    .sort((left, right) => right.matched - left.matched);
  const chosen: DiffFile[] = [];
  let bytes = 0;

  for (const { file } of ranked) {
    if (chosen.length === 0 || bytes + file.text.length <= maximumPartBytes) {
      chosen.push(file);
      bytes += file.text.length;
    }
  }

  return chosen;
}

function lensJobs(parts: readonly ReviewPart[]): readonly LensJob[] {
  const files = parts.flatMap((part) => part.files);
  const touched = lensAssignments(reviewHunks(files)).map((assignment) => assignment.lens);

  return touched
    .map((lens) => {
      const lensFiles = filesForLens({ lens, files });
      const hunks = lensAssignments(reviewHunks(lensFiles)).find((entry) => entry.lens.id === lens.id)?.hunks ?? [];

      return { lens, part: { index: 1, total: 1, files: lensFiles, otherFiles: [], candidates: [] }, hunks };
    })
    .sort((left, right) => right.hunks.length - left.hunks.length);
}

function remainingUsd(options: { readonly maxCostUsd: number | null; readonly spentUsd: number | null }): number | null {
  return options.maxCostUsd === null || options.spentUsd === null ? null : options.maxCostUsd - options.spentUsd;
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

  const { maxCostUsd } = options.setting;
  const judged: Judged[] = [];
  const costs: (number | null)[] = [];
  const skipped: string[] = [];
  const uncovered: string[] = [];
  let spentUsd = options.spentUsd;

  for (const job of lensJobs(options.parts)) {
    const remaining = remainingUsd({ maxCostUsd, spentUsd });

    if (remaining !== null && maxCostUsd !== null && remaining < minimumLensBudgetUsd) {
      skipped.push(`${job.lens.title}: the review used $${(maxCostUsd - remaining).toFixed(2)} of the $${maxCostUsd.toFixed(2)} limit`);
      continue;
    }

    const prompt = reviewPrompt({ skill: options.skill, packet: options.packet, part: job.part, focus: { lens: job.lens, hunks: job.hunks } });

    try {
      const answer = await options.run({ prompt, maxBudgetUsd: remaining });
      const result = await judgeAnswer({ output: answer.output, candidates: [], hunks: job.hunks, sources: options.sources });

      judged.push(result);
      costs.push(answer.costUsd);
      spentUsd = spentUsd === null || answer.costUsd === null ? spentUsd : spentUsd + answer.costUsd;
      uncovered.push(...result.coverage.missing.map((hunk) => `${job.lens.title}: ${hunk.label}`));
    } catch (error) {
      skipped.push(`${job.lens.title}: ${error instanceof Error ? error.message : String(error)}`);
      spentUsd = remaining === null ? spentUsd : maxCostUsd;
    }
  }

  return { judged, costs, runs: judged.length, skipped, uncovered };
}
