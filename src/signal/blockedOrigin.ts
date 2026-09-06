import path from "node:path";
import type { OriginScope } from "./types";

function matchesPattern(value: string, pattern: string): boolean {
  const expression = pattern
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${expression}$`).test(value);
}

export function isOriginBlocked(options: {
  readonly origin: OriginScope;
  readonly cwd: string;
  readonly patterns: readonly string[];
}): boolean {
  if (options.patterns.length === 0) {
    return false;
  }

  const repository = options.cwd ? path.basename(options.cwd) : null;
  const values = [
    options.origin.id,
    ...(repository ? [`${options.origin.id}/${repository}`] : []),
  ];

  return options.patterns.some((pattern) =>
    values.some((value) => matchesPattern(value, pattern)),
  );
}
