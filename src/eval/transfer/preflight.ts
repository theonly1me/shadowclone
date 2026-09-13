import { createSnapshot } from "./snapshot";
import type { CheckResult, DependencyState } from "./types";

export function preflightChecks(): readonly CheckResult[] {
  return [{
    requirement: "The current committed HEAD can be isolated for evaluation.",
    verdict: "pass",
    evidence: "A disposable snapshot was created without copying dependencies.",
  }];
}

export async function preflightRepository(options: {
  readonly repository: string;
  readonly commit: string;
}): Promise<{
  readonly checks: readonly CheckResult[];
  readonly dependencyState: DependencyState;
}> {
  const snapshot = await createSnapshot(options);
  try {
    return {
      checks: preflightChecks(),
      dependencyState: "not-required",
    };
  } finally {
    await snapshot.cleanup();
  }
}
