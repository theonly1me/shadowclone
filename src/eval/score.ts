import type {
  ReplayScore,
  SessionBehavior,
} from "./types";

function setSimilarity(
  leftValues: readonly string[],
  rightValues: readonly string[],
): number {
  const left = new Set(leftValues);
  const right = new Set(rightValues);
  const union = new Set([...left, ...right]);
  if (union.size === 0) {
    return 1;
  }
  const intersection = [...left].filter((value) => right.has(value));
  return intersection.length / union.size;
}

export function scoreReplay(options: {
  readonly actual: SessionBehavior;
  readonly clone: SessionBehavior;
}): ReplayScore {
  const tools = setSimilarity(options.actual.tools, options.clone.tools);
  const verification = setSimilarity(
    options.actual.verificationSteps,
    options.clone.verificationSteps,
  );
  const files = setSimilarity(
    options.actual.filesTouched,
    options.clone.filesTouched,
  );
  const planning =
    options.actual.plannedBeforeEditing === options.clone.plannedBeforeEditing
      ? 1
      : 0;
  return {
    tools,
    verification,
    files,
    planning,
    total: (tools + verification + files + planning) / 4,
  };
}
