import path from "node:path";
import type { ReplayScore, SessionBehavior } from "./types";

function normalizeString(value: string): string {
  return path.posix.normalize(value.replaceAll("\\", "/"));
}

function setSimilarity(
  leftValues: readonly string[] | null,
  rightValues: readonly string[] | null,
): number | null {
  if (leftValues === null || rightValues === null) {
    return null;
  }
  const left = new Set(leftValues.map(normalizeString));
  const right = new Set(rightValues.map(normalizeString));
  const union = new Set([...left, ...right]);
  if (union.size === 0) {
    return null;
  }
  const intersection = [...left].filter((value) => right.has(value));
  return intersection.length / union.size;
}

export function scoreReplay(options: {
  readonly actual: SessionBehavior;
  readonly clone: SessionBehavior;
}): ReplayScore {
  const tools =
    setSimilarity(options.actual.tools, options.clone.tools) ?? 0;
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

  const validDimensions: number[] = [tools, planning];
  if (verification !== null) {
    validDimensions.push(verification);
  }
  if (files !== null) {
    validDimensions.push(files);
  }

  const sum = validDimensions.reduce((acc, value) => acc + value, 0);
  const total = validDimensions.length > 0 ? sum / validDimensions.length : 0;

  return {
    tools,
    verification,
    files,
    planning,
    total,
  };
}
