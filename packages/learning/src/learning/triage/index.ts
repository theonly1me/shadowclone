import { readEffectiveConfig, type ProjectPaths } from "@shadowclone/core";
import type { LearningExecution } from "@shadowclone/agents";
import {
  readEnvironment,
  readRedactedEnvironment,
  recordLearningNotice,
} from "@shadowclone/environment";
import { readCoveredGuidance } from "../coverage";
import { discardLearnings } from "../discard";
import { publishReviewedLearning } from "../publication";
import { publishedRecords, selectTriageCandidates, triageMemoryValue } from "./candidates";
import { requestDecisions } from "./decisions";
import { readTriageMemory, writeTriageMemory } from "./memory";
import type { TriageCandidate } from "./prompt";
import type { TriageDiscardReason } from "./schema";

export type TriageSummary = {
  readonly applied: number;
  readonly discarded: number;
  readonly deferred: number;
};

const noTriage: TriageSummary = { applied: 0, discarded: 0, deferred: 0 };

export async function triagePendingLearning(options: {
  readonly paths: ProjectPaths;
  readonly execution: LearningExecution;
}): Promise<TriageSummary> {
  const { config, policy } = await readEffectiveConfig({
    configPath: options.paths.configFile,
    managedConfigPath: options.paths.managedConfigFile,
  });
  const [state, redacted, memory, coverage] = await Promise.all([
    readEnvironment(options.paths),
    readRedactedEnvironment(options.paths),
    readTriageMemory(options.paths),
    readCoveredGuidance({ paths: options.paths, config, blockedOrigins: policy.blockedOrigins }),
  ]);

  if (state === null || redacted === null) {
    return noTriage;
  }

  const candidates = selectTriageCandidates({ paths: options.paths, state, memory, coverage });

  if (candidates.length === 0 || options.execution.callsRemaining() < 1) {
    return { ...noTriage, deferred: candidates.length };
  }

  const decisions = await requestDecisions({ ...options, candidates, redacted, coverage });
  const discards = new Map<TriageDiscardReason, TriageCandidate[]>();
  const applies: TriageCandidate[] = [];
  const deferred: TriageCandidate[] = [];

  for (const candidate of candidates) {
    const decision = decisions.get(candidate.token);

    if (decision?.verdict === "discard" && decision.reason !== "") {
      discards.set(decision.reason, [...(discards.get(decision.reason) ?? []), candidate]);
    } else if (
      decision?.verdict === "apply" &&
      state.automatic &&
      candidate.destination === "available"
    ) {
      applies.push(candidate);
    } else {
      deferred.push(candidate);
    }
  }

  const revisions: string[] = [];

  for (const [reason, group] of discards) {
    const revision = await discardLearnings({
      paths: options.paths,
      keys: group.map(({ record }) => record.rule.key),
      reason,
      execution: options.execution,
    });

    if (revision !== null) revisions.push(revision);
  }

  if (applies.length > 0) {
    await publishReviewedLearning({
      paths: options.paths,
      keys: applies.map(({ record }) => record.rule.key),
      execution: options.execution,
    });
  }

  const current = (await readEnvironment(options.paths)) ?? state;
  const published = new Set(publishedRecords(current).map(({ rule }) => rule.key));
  const applied = applies.filter(({ record }) => published.has(record.rule.key));
  const stillDeferred = [
    ...deferred,
    ...applies.filter(({ record }) => !published.has(record.rule.key)),
  ];
  const discarded = [...discards.values()].flat();

  await writeTriageMemory({
    paths: options.paths,
    memory: {
      deferred: {
        ...memory.deferred,
        ...Object.fromEntries(
          stillDeferred
            .filter((candidate) => decisions.has(candidate.token))
            .map((candidate) => [
              candidate.record.rule.key,
              triageMemoryValue({ candidate, coverage, state: current }),
            ]),
        ),
      },
    },
  });

  if (applied.length > 0 || discarded.length > 0) {
    const title = (candidate: TriageCandidate) =>
      redacted.records.find(({ rule }) => rule.key === candidate.record.rule.key)?.rule.title ??
      candidate.record.rule.key;

    await recordLearningNotice({
      paths: options.paths,
      applied: applied.map(title),
      discarded: discarded.map(title),
      revisions,
    });
  }

  return { applied: applied.length, discarded: discarded.length, deferred: stillDeferred.length };
}
