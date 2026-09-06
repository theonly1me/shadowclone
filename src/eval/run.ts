import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readEffectiveConfig } from "../config";
import { detectEngine, type EngineRunner } from "../engine";
import { openEventIndex, type IndexedEvent } from "../index";
import { projectPaths, type ProjectPaths } from "../paths";
import { compileProfile } from "../profile";
import { resolveRedacted } from "../redact";
import type { OriginScope } from "../signal";
import {
  extractBehaviorFromActions,
  extractBehaviorFromIndex,
} from "./behavior";
import { computeScoreDelta, scoreReplay } from "./score";
import type {
  EvalReceipt,
  EvalSessionResult,
  ReplayScore,
  ScoreDelta,
} from "./types";

const defaultOrigin: OriginScope = {
  id: "global",
  directoryName: "global",
  promotable: true,
};

export type EvalOptions = {
  readonly sessions?: number;
  readonly since?: string;
  readonly json?: boolean;
  readonly maxBudgetUsd?: number;
  readonly paths?: ProjectPaths;
  readonly configPath?: string;
  readonly runner?: EngineRunner;
};

function avgDimension(values: readonly (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null);
  return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

const averageMetrics = (
  metrics: readonly (ReplayScore | ScoreDelta)[],
): ReplayScore => ({
  tools: avgDimension(metrics.map((s) => s.tools)) ?? 0,
  verification: avgDimension(metrics.map((s) => s.verification)),
  files: avgDimension(metrics.map((s) => s.files)),
  planning: avgDimension(metrics.map((s) => s.planning)) ?? 0,
  total: avgDimension(metrics.map((s) => s.total)) ?? 0,
});

export async function runEval(options: EvalOptions = {}): Promise<EvalReceipt> {
  const paths = options.paths ?? projectPaths;
  const { policy } = await readEffectiveConfig({
    configPath: options.configPath,
    managedConfigPath: paths.managedConfigFile,
  });
  if (!policy.enabled) {
    throw new Error("Shadowclone is disabled by managed policy");
  }
  const detection = options.runner
    ? null
    : await detectEngine({
        purpose: "dispatch",
        allowedEngines: policy.allowedEngines,
      });
  const runner = options.runner ?? detection?.runner;
  if (!runner) {
    throw new Error("No authenticated agent engine is available for eval");
  }
  const index = await openEventIndex(paths.indexDatabase);
  const allEvents = index.listEvents();
  index.close();

  const sessionsMap = new Map<string, IndexedEvent[]>();
  for (const event of allEvents) {
    const list = sessionsMap.get(event.sessionId) ?? [];
    list.push(event);
    sessionsMap.set(event.sessionId, list);
  }

  const sinceTimestamp = options.since ? Date.parse(options.since) : 0;
  const targetSessions = [...sessionsMap.entries()]
    .filter(([_, events]) =>
      Boolean(
        events[0] &&
          events[0].timestamp >= sinceTimestamp &&
          events.some((e) => e.kind === "user-prompt" && e.textRef !== null),
      ),
    )
    .slice(0, options.sessions ?? 10);

  const evalId = crypto.randomUUID();
  const profileDir = path.join(paths.shadowcloneDirectory, "eval", evalId);
  await mkdir(profileDir, { recursive: true });
  const compiledProfilePath = path.join(profileDir, "profile.md");
  await compileProfile({
    profileDirectory: paths.profileDirectory,
    outputPath: compiledProfilePath,
    origin: defaultOrigin,
  });

  const sessionResults: EvalSessionResult[] = [];
  for (const [sessionId, events] of targetSessions) {
    const promptEvent = events.find(
      (e) => e.kind === "user-prompt" && e.textRef !== null,
    );
    if (!promptEvent?.textRef) {
      continue;
    }
    const prompt = await resolveRedacted({ ref: promptEvent.textRef });
    const actual = extractBehaviorFromIndex({ events });

    const baselineCwd = await mkdtemp(
      path.join(os.tmpdir(), "shadowclone-eval-base-"),
    );
    const cloneCwd = await mkdtemp(
      path.join(os.tmpdir(), "shadowclone-eval-clone-"),
    );
    let baselineScore: ReplayScore;
    let cloneScore: ReplayScore;
    try {
      const baselineRun = await runner({
        prompt,
        cwd: baselineCwd,
        sessionId: `eval-base-${sessionId}`,
        permissionMode: "dontAsk",
        maxBudgetUsd: options.maxBudgetUsd ?? 0.5,
      });
      const baselineBehavior = extractBehaviorFromActions({
        actions: baselineRun.actions ?? [],
      });
      baselineScore = scoreReplay({ actual, clone: baselineBehavior });

      const cloneRun = await runner({
        prompt,
        cwd: cloneCwd,
        systemPromptFile: compiledProfilePath,
        sessionId: `eval-clone-${sessionId}`,
        permissionMode: "dontAsk",
        maxBudgetUsd: options.maxBudgetUsd ?? 0.5,
      });
      const cloneBehavior = extractBehaviorFromActions({
        actions: cloneRun.actions ?? [],
      });
      cloneScore = scoreReplay({ actual, clone: cloneBehavior });
    } finally {
      await rm(baselineCwd, { recursive: true, force: true });
      await rm(cloneCwd, { recursive: true, force: true });
    }

    const delta = computeScoreDelta({
      baseline: baselineScore,
      clone: cloneScore,
    });

    sessionResults.push({
      sessionId,
      prompt,
      baseline: baselineScore,
      clone: cloneScore,
      delta,
    });
  }

  const receipt: EvalReceipt = {
    evalId,
    timestamp: new Date().toISOString(),
    sessionsEvaluated: sessionResults.length,
    averageBaseline: averageMetrics(sessionResults.map((r) => r.baseline)),
    averageClone: averageMetrics(sessionResults.map((r) => r.clone)),
    averageDelta: averageMetrics(sessionResults.map((r) => r.delta)),
    sessions: sessionResults,
  };

  const receiptPath = path.join(
    paths.shadowcloneDirectory,
    "eval",
    `${evalId}.json`,
  );
  await Bun.write(receiptPath, JSON.stringify(receipt, null, 2));

  if (options.json) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log(`Evaluated ${receipt.sessionsEvaluated} sessions.`);
    console.log(
      `Total delta: ${(receipt.averageDelta.total * 100).toFixed(1)}% (${(receipt.averageBaseline.total * 100).toFixed(1)}% -> ${(receipt.averageClone.total * 100).toFixed(1)}%)`,
    );
    console.log(`Receipt: ${receiptPath}`);
  }
  return receipt;
}
