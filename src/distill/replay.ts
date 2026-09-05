import type {
  EngineRun,
  EngineRunner,
} from "../engine";
import {
  scoreReplay,
  type ReplayScore,
  type SessionBehavior,
} from "../eval";
import type { TextRef } from "../observe";
import { resolveRedacted } from "../redact";

export async function runReplay(options: {
  readonly promptRef: TextRef;
  readonly actual: SessionBehavior;
  readonly runner: EngineRunner;
  readonly behaviorFromRun: (run: EngineRun) => Promise<SessionBehavior>;
  readonly cwd: string;
  readonly systemPromptFile: string;
  readonly allowedTools: readonly string[];
}): Promise<ReplayScore> {
  const prompt = await resolveRedacted({ ref: options.promptRef });
  const run = await options.runner({
    prompt,
    cwd: options.cwd,
    systemPromptFile: options.systemPromptFile,
    allowedTools: options.allowedTools,
    permissionMode: "dontAsk",
  });
  if (run.isError) {
    throw new Error("The agent engine failed during replay");
  }
  const clone = await options.behaviorFromRun(run);
  return scoreReplay({ actual: options.actual, clone });
}
