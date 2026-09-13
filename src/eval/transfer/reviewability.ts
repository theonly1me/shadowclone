import type { CheckResult } from "./types";

export function reviewabilityChecks(options: {
  readonly repositoryChanged: boolean;
  readonly truncated: boolean;
}): readonly CheckResult[] {
  return [
    {
      requirement: "The agent produced code changes for blinded review.",
      verdict: options.repositoryChanged ? "pass" : "fail",
      evidence: options.repositoryChanged
        ? "The disposable snapshot contains changed files."
        : "The disposable snapshot contains no changed files.",
    },
    {
      requirement: "The complete code change fits within the grading limit.",
      verdict: options.truncated ? "fail" : "pass",
      evidence: options.truncated
        ? "The captured change exceeded the grading limit."
        : "The complete captured change is available to the judges.",
    },
  ];
}
