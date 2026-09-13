import { redactSecrets } from "../../redact";
import type { CheckResult, CheckVote, PreferenceVerdict } from "./types";

export function aggregateVotes<Verdict extends PreferenceVerdict>(options: {
  readonly requirements: readonly string[];
  readonly votes: readonly (readonly CheckVote<Verdict>[])[];
  readonly resolve: (checks: readonly CheckVote<Verdict>[]) => Verdict;
}): readonly CheckResult<Verdict>[] {
  return options.requirements.map((requirement, requirementIndex) => {
    const checks = options.votes.flatMap((vote) => {
      const check = vote[requirementIndex];
      return check
        ? [{ ...check, evidence: redactSecrets({ text: check.evidence }) }]
        : [];
    });
    return {
      requirement,
      verdict: options.resolve(checks),
      evidence: checks.map((check, voteIndex) =>
        `Vote ${voteIndex + 1}: ${check.evidence}`
      ).join("\n"),
      votes: checks,
    };
  });
}

export function binaryMajority(
  checks: readonly CheckVote<PreferenceVerdict>[],
): "pass" | "fail" {
  return checks.filter((check) => check.verdict === "pass").length >= 2
    ? "pass"
    : "fail";
}

export function preferenceMajority(
  checks: readonly CheckVote<PreferenceVerdict>[],
): PreferenceVerdict {
  return checks.filter((check) => check.verdict === "not-applicable").length >= 2
    ? "not-applicable"
    : binaryMajority(checks);
}
