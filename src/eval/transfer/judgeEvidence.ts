import type { CheckResult } from "./types";

export function judgeEvidence(options: {
  readonly observed: string;
  readonly verification: readonly CheckResult[];
}): string {
  return JSON.stringify({
    observed: options.observed,
    independentVerification: options.verification.map((check) => ({
      requirement: check.requirement,
      verdict: check.verdict,
    })),
  });
}
