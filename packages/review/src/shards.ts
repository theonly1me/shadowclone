import type { DiffFile } from "./collect";
import { isGeneratedPath } from "./generated";
import { maximumReportedFindings } from "./rank";
import type { ReviewCandidate } from "./candidates";

export const maximumPartBytes = 150_000;

export const maximumParallelParts = 4;

export type ReviewPart = {
  readonly index: number;
  readonly total: number;
  readonly files: readonly DiffFile[];
  readonly otherFiles: readonly string[];
  readonly candidates: readonly ReviewCandidate[];
};

function groupFiles(files: readonly DiffFile[]): readonly (readonly DiffFile[])[] {
  const groups: DiffFile[][] = [];
  let current: DiffFile[] = [];
  let bytes = 0;

  for (const file of [...files].sort((left, right) => left.path.localeCompare(right.path))) {
    if (current.length > 0 && bytes + file.text.length > maximumPartBytes) {
      groups.push(current);
      current = [];
      bytes = 0;
    }

    current.push(file);
    bytes += file.text.length;
  }

  return current.length > 0 ? [...groups, current] : groups;
}

export function reviewParts(options: {
  readonly files: readonly DiffFile[];
  readonly candidates: readonly ReviewCandidate[];
}): readonly ReviewPart[] {
  const reviewable = options.files.filter((file) => !isGeneratedPath(file.path));
  const groups = groupFiles(reviewable);

  if (groups.length <= 1) {
    return [
      { index: 1, total: 1, files: reviewable, otherFiles: [], candidates: options.candidates },
    ];
  }

  const owner = new Map(
    groups.flatMap((group, index) => group.map((file) => [file.path, index] as const)),
  );

  return groups.map((group, index) => {
    const paths = new Set(group.map((file) => file.path));

    return {
      index: index + 1,
      total: groups.length,
      files: group,
      otherFiles: reviewable.filter((file) => !paths.has(file.path)).map((file) => file.path),
      candidates: options.candidates.filter(
        (candidate) => (owner.get(candidate.path) ?? 0) === index,
      ),
    };
  });
}

export function findingLimit(parts: number): number {
  return Math.min(maximumReportedFindings, 10 * Math.max(1, parts));
}
