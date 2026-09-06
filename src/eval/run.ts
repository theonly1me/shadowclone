import { mkdir } from "node:fs/promises";
import path from "node:path";
import { readEffectiveConfig } from "../config";
import type { EngineId, EngineRunner } from "../engine";
import { openEventIndex } from "../index";
import { projectPaths, type ProjectPaths } from "../paths";
import { compileProfile } from "../profile";
import { resolveRedacted } from "../redact";
import type { OriginScope } from "../signal";
import { extractBehaviorFromIndex } from "./behavior";
import { selectEvalRunner } from "./engine";
import { extractPromptText } from "./prompt";
import { replaySession } from "./replaySession";
import { averageMetrics } from "./score";
import type {
  EvalReceipt,
  EvalSessionResult,
  EvalSkippedSession,
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
  readonly engine?: EngineId;
};

function formatPromptSnippet(prompt: string): string {
  const singleLine = prompt.replaceAll(/\s+/g, " ").trim();
  return singleLine.length > 50 ? `${singleLine.slice(0, 50)}...` : singleLine;
}

export async function runEval(options: EvalOptions = {}): Promise<EvalReceipt> {
  const paths = options.paths ?? projectPaths;
  const { policy } = await readEffectiveConfig({
    configPath: options.configPath,
    managedConfigPath: paths.managedConfigFile,
  });
  if (!policy.enabled) {
    throw new Error("Shadowclone is disabled by managed policy");
  }
  const runner =
    options.runner ??
    (await selectEvalRunner({
      requested: options.engine ?? null,
      allowedEngines: policy.allowedEngines,
    }));
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

  const sessionResults: EvalSessionResult[] = [];
  const skippedSessions: EvalSkippedSession[] = [];

  for (const [sessionId, events] of targetSessions) {
    const promptEvent = events.find(
      (event) => event.kind === "user-prompt" && event.textRef !== null,
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
    const outcome = await replaySession({
      sessionId,
      prompt,
      actual,
      compiledProfilePath,
      runner,
      maxBudgetUsd: options.maxBudgetUsd,
    });

    if ("skipped" in outcome) {
      skippedSessions.push(outcome.skipped);
      const snippet = formatPromptSnippet(prompt);
      console.warn(
        `Skipping session ${sessionId} ("${snippet}"): ${outcome.skipped.phase} replay failed: ${outcome.skipped.reason}`,
      );
      continue;
    }

    sessionResults.push(outcome.result);
  }

  const receipt: EvalReceipt = {
    evalId,
    timestamp: new Date().toISOString(),
    sessionsEvaluated: sessionResults.length,
    sessionsSkipped: skippedSessions.length,
    skippedSessions,
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
    if (receipt.sessionsSkipped > 0) {
      console.log(`Skipped ${receipt.sessionsSkipped} session(s) due to replay errors.`);
    }
    console.log(
      `Total delta: ${(receipt.averageDelta.total * 100).toFixed(1)}% (${(receipt.averageBaseline.total * 100).toFixed(1)}% -> ${(receipt.averageClone.total * 100).toFixed(1)}%)`,
    );
    console.log(`Receipt: ${receiptPath}`);
  }
  return receipt;
}
