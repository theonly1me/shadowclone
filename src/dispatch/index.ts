import path from "node:path";
import {
  readEffectiveConfig,
  type ActionCapability,
} from "../config";
import {
  detectEngine,
  type EngineRunner,
} from "../engine";
import { projectPaths } from "../paths";
import type { ProjectPaths } from "../paths";
import { compileProfile } from "../profile";
import {
  isOriginBlocked,
  resolveRepository,
  type GitRemoteReader,
} from "../signal";
import type { CommandRunner } from "./command";
import { resolveDispatchPolicy } from "./policy";
import { writeReceipt } from "./receipt";
import type { RunReceipt } from "./types";
import {
  commitWorktree,
  createWorktree,
  inspectWorktree,
} from "./worktree";

export { runCommand, type CommandResult, type CommandRunner } from "./command";
export { resolveDispatchPolicy } from "./policy";
export { writeReceipt } from "./receipt";
export type {
  BlockedAction,
  DispatchPolicyInput,
  ResolvedDispatchPolicy,
  RunReceipt,
} from "./types";
export {
  createWorktree,
  commitWorktree,
  inspectWorktree,
  type Worktree,
} from "./worktree";

function taskSlug(task: string): string {
  const slug = task
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return slug || "task";
}

function countProfileRules(profile: string): number {
  return profile.match(/^## /gm)?.length ?? 0;
}

export async function runHeadlessClone(options: {
  readonly task: string;
  readonly targetDirectory?: string;
  readonly approvedActions?: readonly ActionCapability[];
  readonly configPath?: string;
  readonly managedConfigPath?: string | null;
  readonly paths?: ProjectPaths;
  readonly readRemote?: GitRemoteReader;
  readonly runner?: EngineRunner;
  readonly commandRunner?: CommandRunner;
  readonly runId?: string;
  readonly startedAt?: string;
}): Promise<RunReceipt> {
  const targetDirectory = options.targetDirectory ?? process.cwd();
  const paths = options.paths ?? projectPaths;
  const { config, policy: managedPolicy } = await readEffectiveConfig({
    configPath: options.configPath,
    managedConfigPath:
      options.managedConfigPath === undefined
        ? paths.managedConfigFile
        : options.managedConfigPath,
  });
  if (!managedPolicy.enabled || managedPolicy.maxActionTier === "observe") {
    throw new Error("Managed policy does not allow headless clone runs");
  }
  const repository = await resolveRepository({
    cwd: targetDirectory,
    enabled: config.sources["git-metadata"],
    readRemote: options.readRemote,
  });
  if (
    isOriginBlocked({
      origin: repository.origin,
      cwd: targetDirectory,
      patterns: managedPolicy.blockedOrigins,
    })
  ) {
    throw new Error("Managed policy blocks this repository");
  }
  const dispatchPolicy = resolveDispatchPolicy({
    configuredPolicy: config.repo[repository.id] ?? null,
    approvedActions: options.approvedActions ?? [],
    managedActionTier: managedPolicy.maxActionTier,
  });
  if (!managedPolicy.allowedEngines.includes("claude-code")) {
    throw new Error("Managed policy does not allow the Claude Code engine");
  }
  const detection = options.runner ? null : await detectEngine();
  const runner = options.runner ?? detection?.runner;
  if (!runner) {
    throw new Error("No authenticated agent engine is available");
  }

  const runId = options.runId ?? crypto.randomUUID();
  const branch = `shadowclone/${taskSlug(options.task)}-${runId.slice(0, 8)}`;
  const worktree = await createWorktree({
    targetDirectory,
    worktreeDirectory: paths.worktreeDirectory(runId),
    branch,
    runner: options.commandRunner,
  });
  const compiledProfilePath = path.join(paths.runDirectory(runId), "profile.md");
  const profile = await compileProfile({
    profileDirectory: paths.profileDirectory,
    outputPath: compiledProfilePath,
    origin: repository.origin,
    targetRepo: path.basename(worktree.repoDirectory),
  });
  const startedAt = options.startedAt ?? new Date().toISOString();
  const run = await runner({
    prompt: [
      options.task,
      "",
      "Work only in this worktree. Leave the finished change uncommitted.",
      "Do not merge or force push under any circumstance.",
    ].join("\n"),
    cwd: worktree.worktreeDirectory,
    systemPromptFile: compiledProfilePath,
    sessionId: runId,
    allowedTools: dispatchPolicy.allowedTools,
    disallowedTools: dispatchPolicy.disallowedTools,
    permissionMode: dispatchPolicy.permissionMode,
    maxBudgetUsd: dispatchPolicy.maxBudgetUsd,
  });
  if (!run.isError) {
    await commitWorktree({
      worktree,
      runner: options.commandRunner,
    });
  }
  const inspection = await inspectWorktree({
    worktree,
    runner: options.commandRunner,
  });
  const receipt: RunReceipt = {
    runId,
    task: options.task,
    repo: repository.id,
    branch,
    engine: run.engine,
    model: null,
    sessionId: run.sessionId,
    transcriptPath: run.transcriptPath,
    startedAt,
    durationMs: run.durationMs,
    costUsd: run.costUsd,
    turns: run.turns,
    filesChanged: inspection.filesChanged,
    commits: inspection.commits,
    actionsTaken: inspection.commits.length > 0 ? ["commit"] : [],
    actionsBlockedByPolicy: dispatchPolicy.blockedActions,
    permissionDenials: run.permissionDenials,
    profileRulesApplied: countProfileRules(profile),
  };
  await writeReceipt({ runDirectory: paths.runDirectory(runId), receipt });
  if (
    run.isError ||
    (dispatchPolicy.requireCleanExit &&
      !inspection.isClean)
  ) {
    throw new Error("Clone run did not finish cleanly; review its receipt");
  }
  return receipt;
}
