import type { Doubt, RejectedCandidate } from "../types";
import { checkEvidence, type EvidenceSources } from "./verify";

export type JudgedCandidates = {
  readonly refuted: readonly RejectedCandidate[];
  readonly worthChecking: readonly Doubt[];
};

const refutingSources = new Set(["code", "diff", "doc"]);

function doubtFrom(options: { readonly candidate: RejectedCandidate; readonly reason: string }): Doubt {
  const { candidate } = options;

  return {
    path: candidate.path,
    line: candidate.line,
    title: candidate.title,
    failureScenario: candidate.failureScenario,
    reason: options.reason.slice(0, 300),
  };
}

async function judgeRejection(options: {
  readonly candidate: RejectedCandidate;
  readonly sources: EvidenceSources;
}): Promise<RejectedCandidate | Doubt> {
  const { candidate, sources } = options;
  const checks = await Promise.all(candidate.evidence.map((item) => checkEvidence({ item, sources })));
  const failed = checks.find((check) => !check.verified);

  if (failed !== undefined && !failed.verified) {
    return doubtFrom({ candidate, reason: `The refutation did not hold: ${failed.reason}.` });
  }

  if (!candidate.evidence.some((item) => refutingSources.has(item.source))) {
    return doubtFrom({ candidate, reason: "The refutation quotes no code, diff, or documentation." });
  }

  return candidate;
}

export async function judgeCandidates(options: {
  readonly rejected: readonly RejectedCandidate[];
  readonly unresolved: readonly Doubt[];
  readonly sources: EvidenceSources;
}): Promise<JudgedCandidates> {
  const outcomes = await Promise.all(
    options.rejected.map((candidate) => judgeRejection({ candidate, sources: options.sources })),
  );

  return {
    refuted: outcomes.filter((outcome): outcome is RejectedCandidate => "refutation" in outcome),
    worthChecking: [
      ...outcomes.filter((outcome): outcome is Doubt => "reason" in outcome),
      ...options.unresolved,
    ],
  };
}
