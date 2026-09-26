import type {
  CompilerBlock,
  ProfileCompilationOmission,
  ProfileCompilationRepositoryContext,
} from "./types";

function authorityRank(block: CompilerBlock): number {
  if (block.source === "user") return 0;
  if (block.source === "declared") return 1;
  if (block.source === "mined") return 2;
  if (block.source === "reference") return 3;
  return 4;
}

function compareBlocks(left: CompilerBlock, right: CompilerBlock): number {
  return (
    authorityRank(left) - authorityRank(right) ||
    right.observations - left.observations ||
    (left.ruleKey ?? left.referenceKey ?? "").localeCompare(
      right.ruleKey ?? right.referenceKey ?? "",
    ) ||
    left.visible.localeCompare(right.visible)
  );
}

export function selectCompilerBlocks(options: {
  readonly blocks: readonly CompilerBlock[];
  readonly axes: ReadonlyMap<string, string>;
  readonly repositoryContext: ProfileCompilationRepositoryContext;
}): {
  readonly selected: readonly CompilerBlock[];
  readonly omissions: readonly ProfileCompilationOmission[];
  readonly omittedBlocks: readonly CompilerBlock[];
} {
  const omissions: ProfileCompilationOmission[] = [];
  const omittedBlocks: CompilerBlock[] = [];
  const eligible: CompilerBlock[] = [];

  for (const block of options.blocks) {
    if (
      block.source === "imported" &&
      options.repositoryContext === "native"
    ) {
      omissions.push({ ruleKey: block.ruleKey, reason: "native-duplicate" });
      omittedBlocks.push(block);
      continue;
    }
    if (block.status === "active") {
      eligible.push(block);
      continue;
    }
    omissions.push({
      ruleKey: block.ruleKey,
      reason: block.status,
    });
    omittedBlocks.push(block);
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
      omittedBlocks.push(block);
      continue;
    }
    claimedAxes.add(axis);
    selected.push(block);
  }

  return { selected, omissions, omittedBlocks };
}
