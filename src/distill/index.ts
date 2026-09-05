import type { EngineRunner } from "../engine";
import type { IndexedEvent } from "../index";
import type { ProfileRule } from "../profile";
import type { CorrectionSignal } from "../signal";
import {
  buildDistillPrompt,
  groupDistillBatches,
} from "./batch";
import {
  readCheckpoint,
  writeCheckpoint,
} from "./checkpoint";
import {
  distillationOutputSchema,
  parseDistilledRules,
} from "./schema";
import { allowlistedSignals } from "./eligible";

export { buildDistillPrompt, groupDistillBatches } from "./batch";
export type { DistillBatch } from "./batch";
export {
  allowlistedSignals,
  isEligibleForDistillation,
} from "./eligible";
export { runReplay } from "./replay";
export {
  distillationOutputSchema,
  parseDistilledRules,
  type DistilledRule,
} from "./schema";

export type DistillationResult = {
  readonly rules: readonly ProfileRule[];
  readonly engineRuns: number;
};

function profileRules(options: {
  readonly value: unknown;
  readonly signals: readonly CorrectionSignal[];
}): readonly ProfileRule[] {
  const [first] = options.signals;
  if (!first) {
    return [];
  }
  const observations = options.signals.length;
  const sessions = new Set(
    options.signals.map((signal) => signal.sessionId),
  ).size;
  const lastTimestamp = Math.max(
    ...options.signals.map((signal) => signal.timestamp),
  );
  return parseDistilledRules(options.value).map((rule) => {
    const key = new Bun.CryptoHasher("sha256")
      .update(`semantic:${rule.title.toLowerCase()}`)
      .digest("hex")
      .slice(0, 16);
    return {
      ...rule,
      key,
      scope: "org",
      originDirectory: first.origin.directoryName,
      observations,
      confidence: 1,
      lastSeen:
        lastTimestamp > 0
          ? new Date(lastTimestamp).toISOString().slice(0, 10)
          : "unknown",
      sessions,
      origins: [first.origin.id],
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
    const value: unknown = JSON.parse(run.text);
    return value;
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
}): Promise<DistillationResult> {
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

  return { rules, engineRuns };
}
