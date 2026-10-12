import type { ProjectPaths } from "@shadowclone/core";
import { learningScopes, pendingLearningRecords, recordFingerprint, type EnvironmentState } from "@shadowclone/environment";
import type { TriageCandidate } from "./prompt";
import type { TriageMemory } from "./memory";

const maximumCandidates = 32;

export function triageMemoryValue(candidate: TriageCandidate): string {
  return `${recordFingerprint(candidate.record)}:${candidate.destination}`;
}

export function selectTriageCandidates(options: {
  readonly paths: ProjectPaths;
  readonly state: EnvironmentState;
  readonly memory: TriageMemory;
}): readonly TriageCandidate[] {
  const destinations = new Map<string, TriageCandidate["destination"]>();
  const sharedScopes = new Set(learningScopes(options)
    .filter(({ repository }) => repository !== null && !repository.privateSkillsDirectory)
    .map(({ key }) => key));

  for (const entry of pendingLearningRecords(options)) {
    if (entry.status === "awaiting-publication") {
      destinations.set(entry.key, sharedScopes.has(entry.scope) ? "approval-needed" : "available");
    } else if (entry.status === "unresolved-scope" && !destinations.has(entry.key)) {
      destinations.set(entry.key, "repository-choice-needed");
    }
  }

  return options.state.records
    .flatMap((record) => {
      const destination = destinations.get(record.rule.key);

      return destination ? [{ token: "", record, destination }] : [];
    })
    .filter((candidate) => options.memory.deferred[candidate.record.rule.key] !== triageMemoryValue(candidate))
    .slice(0, maximumCandidates)
    .map((candidate, index) => ({ ...candidate, token: `learning-${index + 1}` }));
}
