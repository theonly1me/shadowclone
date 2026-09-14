import type { ReasoningEffort } from "../engine";
import type { DependencyMode } from "../eval/transfer";

export function rejectRepeat(
  flag: string,
): (value: string, previous: string | undefined) => string {
  const [name] = flag.split(" ");
  return (value, previous) => {
    if (previous !== undefined) {
      throw new Error(`Repeated ${name ?? flag}`);
    }
    return value;
  };
}
export function parsePositiveNumber(options: {
  readonly value: string | undefined;
  readonly name: string;
}): number | undefined {
  if (options.value === undefined) {
    return undefined;
  }
  const numericValue = Number(options.value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    throw new Error(`${options.name} must be positive`);
  }
  return numericValue;
}
export function parseReasoningEffort(
  value: string | undefined,
): ReasoningEffort | undefined {
  switch (value) {
    case undefined:
    case "low":
    case "medium":
    case "high":
    case "xhigh":
    case "max":
      return value;
    default:
      throw new Error("Invalid --reasoning-effort");
  }
}

export function parseDependencyMode(
  value: string | undefined,
): DependencyMode | undefined {
  switch (value) {
    case undefined:
    case "current":
      return value;
    default:
      throw new Error("Invalid --dependency-mode");
  }
}
