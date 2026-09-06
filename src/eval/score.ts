import path from "node:path";
import type {
  ReplayScore,
  ScoreDelta,
  SessionBehavior,
} from "./types";

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

export function computeScoreDelta(options: {
  readonly baseline: ReplayScore;
  readonly clone: ReplayScore;
}): ScoreDelta {
  const deltaVal = (c: number | null, b: number | null): number | null => {
    if (c === null || b === null) {
      return null;
    }
    return c - b;
  };
  return {
    tools: options.clone.tools - options.baseline.tools,
    verification: deltaVal(
      options.clone.verification,
      options.baseline.verification,
    ),
    files: deltaVal(options.clone.files, options.baseline.files),
    planning: options.clone.planning - options.baseline.planning,
    total: options.clone.total - options.baseline.total,
  };
}

function averageDimension(
  values: readonly (number | null)[],
): number | null {
  const numbers = values.filter((value): value is number => value !== null);
  return numbers.length > 0
    ? numbers.reduce((accumulator, value) => accumulator + value, 0) /
        numbers.length
    : null;
}

export function averageMetrics(
  metrics: readonly (ReplayScore | ScoreDelta)[],
): ReplayScore {
  return {
    tools: averageDimension(metrics.map((metric) => metric.tools)) ?? 0,
    verification: averageDimension(metrics.map((metric) => metric.verification)),
    files: averageDimension(metrics.map((metric) => metric.files)),
    planning: averageDimension(metrics.map((metric) => metric.planning)) ?? 0,
    total: averageDimension(metrics.map((metric) => metric.total)) ?? 0,
  };
}
