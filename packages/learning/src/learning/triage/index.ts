import { readEffectiveConfig, type ProjectPaths } from "@shadowclone/core";
import type { LearningExecution } from "@shadowclone/agents";
import {
  readEnvironment,
  readRedactedEnvironment,
  recordLearningNotice,
  type EnvironmentState,
} from "@shadowclone/environment";
import { redactSecrets } from "@shadowclone/redact";
import { structuredValue } from "../../distill/reconcile/run";
import { readCoveredGuidance } from "../coverage";
import { discardLearnings } from "../discard";
import { publishReviewedLearning } from "../publication";
import { selectTriageCandidates, triageMemoryValue } from "./candidates";
import { readTriageMemory, writeTriageMemory } from "./memory";
import { buildTriagePrompt, type TriageCandidate } from "./prompt";
import { parseTriageOutput, triageOutputSchema, type TriageDiscardReason } from "./schema";

export type TriageSummary = {
  readonly applied: number;
  readonly discarded: number;
  readonly deferred: number;
};

const noTriage: TriageSummary = { applied: 0, discarded: 0, deferred: 0 };

function publishedRecords(state: EnvironmentState) {
  return state.records.filter(({ rule }) =>
    state.dispositions.some((entry) => entry.key === rule.key && entry.status === "published"),
  );
}

async function requestDecisions(options: {
  readonly paths: ProjectPaths;
  readonly execution: LearningExecution;
  readonly candidates: readonly TriageCandidate[];
  readonly redacted: EnvironmentState;
}) {
  const { config } = await readEffectiveConfig({
    configPath: options.paths.configFile, managedConfigPath: options.paths.managedConfigFile,
  });
  const redactedRecords = new Map(options.redacted.records.map((record) => [record.rule.key, record]));
  const run = await options.execution.runner({
    prompt: buildTriagePrompt({
      candidates: options.candidates.map((candidate) => ({
        ...candidate, record: redactedRecords.get(candidate.record.rule.key) ?? candidate.record,
      })),
      published: publishedRecords(options.redacted),
      coverage: await readCoveredGuidance({ paths: options.paths, config }),
    }),
    cwd: options.paths.shadowcloneDirectory,
    execution: { purpose: "learning" },
    allowedTools: [],
    permissionMode: "dontAsk",
    outputSchema: triageOutputSchema,
  });

  if (run.isError) {
    throw new Error(`The agent engine failed during triage: ${redactSecrets({ text: run.errorMessage ?? "no engine detail" })}`);
  }

  return new Map(parseTriageOutput(structuredValue({ run, purpose: "triage" })).map((decision) => [decision.token, decision]));
}

export async function triagePendingLearning(options: {
  readonly paths: ProjectPaths;
  readonly execution: LearningExecution;
}): Promise<TriageSummary> {
  const [state, redacted, memory] = await Promise.all([
    readEnvironment(options.paths),
    readRedactedEnvironment(options.paths),
    readTriageMemory(options.paths),
  ]);

  if (state === null || redacted === null) {
    return noTriage;
  }

  const candidates = selectTriageCandidates({ paths: options.paths, state, memory });

  if (candidates.length === 0 || options.execution.callsRemaining() < 1) {
    return { ...noTriage, deferred: candidates.length };
  }

  const decisions = await requestDecisions({ ...options, candidates, redacted });
  const discards = new Map<TriageDiscardReason, TriageCandidate[]>();
  const applies: TriageCandidate[] = [];
  const deferred: TriageCandidate[] = [];

  for (const candidate of candidates) {
    const decision = decisions.get(candidate.token);

    if (decision?.verdict === "discard" && decision.reason !== "") {
      discards.set(decision.reason, [...(discards.get(decision.reason) ?? []), candidate]);
    } else if (decision?.verdict === "apply" && state.automatic && candidate.destination === "available") {
      applies.push(candidate);
    } else {
      deferred.push(candidate);
    }
  }

  const revisions: string[] = [];

  for (const [reason, group] of discards) {
    const revision = await discardLearnings({
      paths: options.paths, keys: group.map(({ record }) => record.rule.key), reason, execution: options.execution,
    });

    if (revision !== null) revisions.push(revision);
  }

  if (applies.length > 0) {
    await publishReviewedLearning({ paths: options.paths, keys: applies.map(({ record }) => record.rule.key), execution: options.execution });
  }

  const published = new Set(publishedRecords((await readEnvironment(options.paths)) ?? state).map(({ rule }) => rule.key));
  const applied = applies.filter(({ record }) => published.has(record.rule.key));
  const stillDeferred = [...deferred, ...applies.filter(({ record }) => !published.has(record.rule.key))];
  const discarded = [...discards.values()].flat();

  await writeTriageMemory({
    paths: options.paths,
    memory: { deferred: { ...memory.deferred, ...Object.fromEntries(stillDeferred.map((candidate) => [candidate.record.rule.key, triageMemoryValue(candidate)])) } },
  });

  if (applied.length > 0 || discarded.length > 0) {
    const title = (candidate: TriageCandidate) =>
      redacted.records.find(({ rule }) => rule.key === candidate.record.rule.key)?.rule.title ?? candidate.record.rule.key;

    await recordLearningNotice({
      paths: options.paths, applied: applied.map(title), discarded: discarded.map(title), revisions,
    });
  }

  return { applied: applied.length, discarded: discarded.length, deferred: stillDeferred.length };
}
