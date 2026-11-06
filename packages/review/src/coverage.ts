import type { ReviewHunk } from "./hunks";
import type { Coverage } from "./types";

export type CoverageCheck = {
  readonly problems: readonly string[];
  readonly missing: readonly ReviewHunk[];
};

export function checkCoverage(options: {
  readonly hunks: readonly ReviewHunk[];
  readonly coverage: readonly Coverage[];
}): CoverageCheck {
  const known = new Set(options.hunks.map((hunk) => hunk.id));
  const listed = new Set(options.coverage.map((entry) => entry.hunk));
  const unknown = [...listed].filter((id) => !known.has(id));
  const missing = options.hunks.filter((hunk) => !listed.has(hunk.id));
  const problems = [
    ...(unknown.length > 0 ? [`${unknown.join(", ")} are not hunk ids in this packet.`] : []),
    ...(missing.length > 0
      ? [`${missing.map((hunk) => hunk.id).join(", ")} have no coverage entry. Read each of these hunks and give it a result.`]
      : []),
  ];

  return { problems, missing };
}
