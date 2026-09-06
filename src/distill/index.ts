import type { EngineRunner } from "../engine";
import type { IndexedEvent } from "../index";
import { semanticRuleKey } from "../profile";
import type { ProfileRule } from "../profile";
import type { CorrectionSignal } from "../signal";
import { buildDistillPrompt, groupDistillBatches } from "./batch";
import { readCheckpoint, writeCheckpoint } from "./checkpoint";
import { distillationOutputSchema, parseDistilledRules } from "./schema";
import { mergeDistilledRules } from "./merge";
import { allowlistedSignals } from "./eligible";

export { buildDistillPrompt, groupDistillBatches, type DistillBatch } from "./batch";
export { allowlistedSignals, isEligibleForDistillation } from "./eligible";
export { runReplay } from "./replay";
export {
  distillationMergeOutputSchema,
  distillationOutputSchema,
  parseDistilledRules,
  type DistilledRule,
} from "./schema";

export type DistillationResult = {
  readonly rules: readonly ProfileRule[];
  readonly engineRuns: number[];
};

function profileRules(options: {
  readonly value: unknown;
  readonly signals: readonly CorrectionSignal[];
  readonly originRules?: readonly ProfileRule[];
}): readonly ProfileRule[] {
  const [first] = options.signals;
  if (!first) {
    return [];
  }
  const defaultObservations = options.signals.length;
  const defaultSessions = new Set(
    options.signals.map((signal) => signal.sessionId),
  ).size;
  const lastTimestamp = Math.max(
    ...options.signals.map((signal) => signal.timestamp),
  );
  const defaultLastSeen =
    lastTimestamp > 0
      ? new Date(lastTimestamp).toISOString().slice(0, 10)
      : "unknown";

  return parseDistilledRules(options.value).map((rule) => {
    const key = semanticRuleKey(rule.title);
    const constituent = (rule.sources ?? []).flatMap((idx) =>
      options.originRules?.[idx] ? [options.originRules[idx]] : [],
    );
    const observations =
      constituent.length > 0
        ? constituent.reduce((sum, r) => sum + r.observations, 0)
        : defaultObservations;
    const sessions =
      constituent.length > 0
        ? Math.max(...constituent.map((r) => r.sessions))
        : defaultSessions;
    const lastSeen =
      constituent.length > 0
        ? constituent.map((r) => r.lastSeen).sort().at(-1) ?? defaultLastSeen
        : defaultLastSeen;
    const origins =
      constituent.length > 0
        ? [...new Set(constituent.flatMap((r) => r.origins))].sort()
        : [first.origin.id];

    return {
      title: rule.title,
      body: rule.body,
      section: rule.section,
      key,
      scope: "org",
      originDirectory: first.origin.directoryName,
      observations,
      confidence: Number(Math.min(1, sessions / 3).toFixed(2)),
      lastSeen,
      sessions,
      origins,
    };
  });
}

function structuredValue(run: {
  readonly structured: unknown;
  readonly text: string;
}): unknown {
  if (run.structured !== null && run.structured !== undefined) {
    return run.structured;
  }
  try {
    return JSON.parse(run.text);
  } catch {
    throw new Error("The engine returned no structured distillation result");
  }
}

export async function distillSignals(options: {
  readonly signals: readonly CorrectionSignal[];
  readonly runner: EngineRunner;
  readonly workingDirectory: string;
  readonly checkpointDirectory: string;
  readonly maxBudgetUsd?: number;
  readonly events: readonly IndexedEvent[];
}): Promise<{ readonly rules: readonly ProfileRule[]; readonly engineRuns: number }> {
  const rules: ProfileRule[] = [];
  let engineRuns = 0;
  const signals = allowlistedSignals({
    signals: options.signals,
    events: options.events,
  }).filter((signal) => signal.textRefs.length > 0);

  for (const batch of groupDistillBatches({ signals })) {
    const checkpoint = await readCheckpoint({
      checkpointDirectory: options.checkpointDirectory,
      batch,
    });
    if (checkpoint !== null) {
      rules.push(...checkpoint);
      continue;
    }

    const prompt = await buildDistillPrompt({ signals: batch.signals });
    const run = await options.runner({
      prompt,
      cwd: options.workingDirectory,
      allowedTools: [],
      permissionMode: "dontAsk",
      maxBudgetUsd: options.maxBudgetUsd,
      outputSchema: distillationOutputSchema,
    });
    engineRuns += 1;
    if (run.isError) {
      throw new Error("The agent engine failed during distillation");
    }
    const batchRules = profileRules({
      value: structuredValue(run),
      signals: batch.signals,
    });
    await writeCheckpoint({
      checkpointDirectory: options.checkpointDirectory,
      batch,
      rules: batchRules,
    });
    rules.push(...batchRules);
  }

  const rulesByOrigin = Map.groupBy(rules, (rule) => rule.originDirectory);
  const finalRules: ProfileRule[] = [];

  for (const [originDirectory, originRules] of rulesByOrigin.entries()) {
    if (originRules.length <= 1) {
      finalRules.push(...originRules);
      continue;
    }

    let didMerge = false;
    const mergedRaw = await mergeDistilledRules({
      rules: originRules.map((r) => ({
        title: r.title,
        body: r.body,
        section: r.section,
      })),
      runner: async (opts) => {
        didMerge = true;
        return options.runner(opts);
      },
      cwd: options.workingDirectory,
      maxBudgetUsd: options.maxBudgetUsd,
      checkpointDirectory: options.checkpointDirectory,
    });
    if (didMerge) {
      engineRuns += 1;
    }

    const originSignals = signals.filter(
      (s) => s.origin.directoryName === originDirectory,
    );
    finalRules.push(
      ...profileRules({
        value: { rules: mergedRaw },
        signals: originSignals,
        originRules,
      }),
    );
  }

  return { rules: finalRules, engineRuns };
}
