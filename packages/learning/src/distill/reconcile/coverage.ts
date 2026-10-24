import type { CoveredGuidance } from "./types";

export function applicableCoverage(options: {
  readonly coverage: readonly CoveredGuidance[];
  readonly originDirectory: string | null;
  readonly repositoryName: string | null;
}): readonly CoveredGuidance[] {
  const coverage = options.coverage.filter(
    (entry) =>
      entry.repository === undefined ||
      (entry.repository.originDirectory === options.originDirectory &&
        entry.repository.repositoryName === options.repositoryName),
  );
  const bytes = coverage.reduce((total, entry) => total + Buffer.byteLength(entry.text), 0);
  if (bytes > 512_000)
    throw new Error(
      "Duplicate-check guidance exceeds 512 KB. Learning stopped before proposing rules.",
    );
  return coverage;
}
