import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readEffectiveConfig } from "../config";
import { detectEngine, type EngineRunner } from "../engine";
import { openEventIndex } from "../index";
import { projectPaths, type ProjectPaths } from "../paths";
import { compileProfile } from "../profile";
import { resolveRedacted } from "../redact";
import type { OriginScope } from "../signal";
import {
  extractBehaviorFromActions,
  extractBehaviorFromIndex,
} from "./behavior";
import { extractPromptText } from "./prompt";
import { averageMetrics, computeScoreDelta, scoreReplay } from "./score";
import type {
  EvalReceipt,
  EvalSessionResult,
  ReplayScore,
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

  const sessionsMap = Map.groupBy(allEvents, (event) => event.sessionId);

  const sinceTimestamp = options.since ? Date.parse(options.since) : 0;
  const targetSessions = [...sessionsMap.entries()]
    .filter(([_, events]) =>
      Boolean(
        events?.[0] &&
          events[0].timestamp >= sinceTimestamp &&
          events.some((event) => event.kind === "user-prompt" && event.textRef !== null),
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

  let sessionsSkipped = 0;
  const sessionResults: EvalSessionResult[] = [];
  for (const [sessionId, events] of targetSessions) {
    const promptEvent = events.find(
      (e) => e.kind === "user-prompt" && e.textRef !== null,
    );
    if (!promptEvent?.textRef) {
      continue;
    }
    const rawPrompt = await resolveRedacted({ ref: promptEvent.textRef });
    const prompt = extractPromptText(rawPrompt);
    if (!prompt) {
      continue;
    }
    const actual = extractBehaviorFromIndex({ events });

    const baselineCwd = await mkdtemp(
      path.join(os.tmpdir(), "shadowclone-eval-base-"),
    );
    const cloneCwd = await mkdtemp(
      path.join(os.tmpdir(), "shadowclone-eval-clone-"),
    );
    let baselineScore: ReplayScore;
    let cloneScore: ReplayScore;
    let baselineSessionId = "";
    let cloneSessionId = "";
    try {
      const baselineRun = await runner({
        prompt,
        cwd: baselineCwd,
        sessionId: crypto.randomUUID(),
        permissionMode: "dontAsk",
        maxBudgetUsd: options.maxBudgetUsd ?? 0.5,
      });
      if (baselineRun.isError) {
        sessionsSkipped += 1;
        console.warn(`Skipping session ${sessionId}: baseline replay failed`);
        continue;
      }
      baselineSessionId = baselineRun.sessionId;
      const baselineBehavior = extractBehaviorFromActions({
        actions: baselineRun.actions ?? [],
      });
      baselineScore = scoreReplay({ actual, clone: baselineBehavior });

      const cloneRun = await runner({
        prompt,
        cwd: cloneCwd,
        systemPromptFile: compiledProfilePath,
        sessionId: crypto.randomUUID(),
        permissionMode: "dontAsk",
        maxBudgetUsd: options.maxBudgetUsd ?? 0.5,
      });
      if (cloneRun.isError) {
        sessionsSkipped += 1;
        console.warn(`Skipping session ${sessionId}: clone replay failed`);
        continue;
      }
      cloneSessionId = cloneRun.sessionId;
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
      baselineSessionId,
      cloneSessionId,
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
    sessionsSkipped,
    averageBaseline: averageMetrics(sessionResults.map((entry) => entry.baseline)),
    averageClone: averageMetrics(sessionResults.map((entry) => entry.clone)),
    averageDelta: averageMetrics(sessionResults.map((entry) => entry.delta)),
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
