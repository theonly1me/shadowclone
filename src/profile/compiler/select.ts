import type { ProfileSource } from "../types";
import type { CompilerBlock, ProfileCompilationOmission } from "./types";

const userOwnedSources: ReadonlySet<ProfileSource> = new Set<ProfileSource>([
  "user",
  "declared",
  "imported",
]);

function authorityRank(block: CompilerBlock): number {
  return userOwnedSources.has(block.source) ? 0 : 1;
}

function compareBlocks(left: CompilerBlock, right: CompilerBlock): number {
  return (
    authorityRank(left) - authorityRank(right) ||
    right.observations - left.observations ||
    (left.ruleKey ?? "").localeCompare(right.ruleKey ?? "") ||
    left.visible.localeCompare(right.visible)
  );
}

export function selectCompilerBlocks(options: {
  readonly blocks: readonly CompilerBlock[];
  readonly axes: ReadonlyMap<string, string>;
}): {
  readonly selected: readonly CompilerBlock[];
  readonly omissions: readonly ProfileCompilationOmission[];
} {
  const omissions: ProfileCompilationOmission[] = [];
  const eligible: CompilerBlock[] = [];

  for (const block of options.blocks) {
    if (block.status === "active") {
      eligible.push(block);
      continue;
    }
    omissions.push({ ruleKey: block.ruleKey, reason: block.status });
  }

  const claimedAxes = new Set<string>();
  const selected: CompilerBlock[] = [];

  for (const block of [...eligible].sort(compareBlocks)) {
    const axis =
      block.ruleKey === null ? undefined : options.axes.get(block.ruleKey);
    if (axis === undefined) {
      selected.push(block);
      continue;
    }
    if (claimedAxes.has(axis)) {
      omissions.push({ ruleKey: block.ruleKey, reason: "axis-conflict" });
      continue;
    }
    claimedAxes.add(axis);
    selected.push(block);
  }

  return { selected, omissions };
}
