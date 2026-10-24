import { fingerprint, type ProjectPaths } from "@shadowclone/core";
import {
  learningScopes,
  pendingLearningRecords,
  recordFingerprint,
  type EnvironmentState,
} from "@shadowclone/environment";
import type { TriageCandidate } from "./prompt";
import type { TriageMemory } from "./memory";
import type { CoveredGuidance } from "../../distill";
import { applicableCoverage } from "../../distill/reconcile/coverage";
import type { LearningRecord } from "@shadowclone/environment";

const maximumCandidates = 32;

export function publishedRecords(state: EnvironmentState): readonly LearningRecord[] {
  return state.records.filter(({ rule }) =>
    state.dispositions.some((entry) => entry.key === rule.key && entry.status === "published"),
  );
}

export function applicablePublished(options: {
  readonly records: readonly LearningRecord[];
  readonly record: LearningRecord;
}): readonly LearningRecord[] {
  const rule = options.record.rule;
  return options.records.filter(
    ({ rule: published }) =>
      published.scope === "global" ||
      (rule.scope !== "global" &&
        published.originDirectory === rule.originDirectory &&
        (published.scope === "org" ||
          (rule.scope === "project" && published.repositoryName === rule.repositoryName))),
  );
}

export function candidateCoverage(options: {
  readonly candidate: TriageCandidate;
  readonly coverage: readonly CoveredGuidance[];
}): readonly CoveredGuidance[] {
  return applicableCoverage({
    coverage: options.coverage,
    originDirectory: options.candidate.record.rule.originDirectory,
    repositoryName: options.candidate.record.rule.repositoryName,
  });
}

export function triageMemoryValue(options: {
  readonly candidate: TriageCandidate;
  readonly coverage: readonly CoveredGuidance[];
  readonly state: EnvironmentState;
}): string {
  return fingerprint(
    JSON.stringify({
      rule: recordFingerprint(options.candidate.record),
      destination: options.candidate.destination,
      automatic: options.state.automatic,
      coverage: candidateCoverage(options),
      published: applicablePublished({
        records: publishedRecords(options.state),
        record: options.candidate.record,
      }).map(recordFingerprint),
    }),
  );
}

export function selectTriageCandidates(options: {
  readonly paths: ProjectPaths;
  readonly state: EnvironmentState;
  readonly memory: TriageMemory;
  readonly coverage: readonly CoveredGuidance[];
}): readonly TriageCandidate[] {
  const destinations = new Map<string, TriageCandidate["destination"]>();
  const sharedScopes = new Set(
    learningScopes(options)
      .filter(({ repository }) => repository !== null && !repository.privateSkillsDirectory)
      .map(({ key }) => key),
  );

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
    .filter(
      (candidate) =>
        options.memory.deferred[candidate.record.rule.key] !==
        triageMemoryValue({ candidate, coverage: options.coverage, state: options.state }),
    )
    .slice(0, maximumCandidates)
    .map((candidate, index) => ({ ...candidate, token: `learning-${index + 1}` }));
}
