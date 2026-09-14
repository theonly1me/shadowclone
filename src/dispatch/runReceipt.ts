import type { EngineRun } from "../engine";
import type { RunReceipt, BlockedAction } from "./types";

function taskHash(task: string): string {
  return new Bun.CryptoHasher("sha256").update(task).digest("hex").slice(0, 16);
}

export function runReceipt(options: {
  readonly runId: string;
  readonly task: string;
  readonly repositoryId: string;
  readonly branch: string;
  readonly run: EngineRun;
  readonly startedAt: string;
  readonly inspection: {
    readonly filesChanged: readonly string[];
    readonly commits: readonly string[];
  };
  readonly actionsTaken: readonly string[];
  readonly blockedActions: readonly BlockedAction[];
  readonly profileRulesApplied: number;
}): RunReceipt {
  return {
    runId: options.runId,
    taskSlug: "task",
    taskHash: taskHash(options.task),
    repo: options.repositoryId,
    branch: options.branch,
    engine: options.run.engine,
    model: null,
    sessionId: options.run.sessionId,
    startedAt: options.startedAt,
    durationMs: options.run.durationMs,
    costUsd: options.run.costUsd,
    turns: options.run.turns,
    filesChanged: options.inspection.filesChanged,
    commits: options.inspection.commits,
    actionsTaken: options.actionsTaken,
    actionsBlockedByPolicy: options.blockedActions,
    permissionDenials: options.run.permissionDenials,
    profileRulesApplied: options.profileRulesApplied,
  };
}
