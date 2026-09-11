import { runReceipt } from "./runReceipt";
import { z } from "zod";
import { executeRemoteActions, remoteDraftSchema } from "./remoteActions";
import path from "node:path";
import { readEffectiveConfig, type ActionCapability } from "../config";
import { detectEngine, type EngineRunner } from "../engine";
import { projectPaths } from "../paths";
import type { ProjectPaths } from "../paths";
import { compileProfile } from "../profile";
import {
  isOriginBlocked,
  resolveRepository,
  type GitRemoteReader,
} from "../signal";
import type { CommandRunner } from "./command";
import { resolveDispatchPolicy, validateRemoteGrants } from "./policy";
import { writeReceipt } from "./receipt";
import type { RunReceipt } from "./types";
import { detectVerificationTools } from "./verify";
import {
  commitWorktree,
  createWorktree,
  inspectWorktree,
  pushWorktree,
} from "./worktree";

export async function runHeadlessClone(options: {
  readonly task: string;
  readonly pullRequestNumber?: number;
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
      repository,
      patterns: managedPolicy.blockedOrigins,
    })
  ) {
    throw new Error("Managed policy blocks this repository");
  }
  const verificationTools = await detectVerificationTools({
    cwd: targetDirectory,
  });
  const dispatchPolicy = resolveDispatchPolicy({
    configuredPolicy: config.repo[repository.id] ?? null,
    approvedActions: options.approvedActions ?? [],
    managedActionTier: managedPolicy.maxActionTier,
    verificationTools,
  });
  validateRemoteGrants({
    grantedActions: dispatchPolicy.grantedActions,
    pullRequestNumber: options.pullRequestNumber,
  });
  const needsRemoteDraft = dispatchPolicy.grantedActions.some(
    (action) => action === "pr-draft" || action === "pr-reply",
  );
  const detection = options.runner
    ? null
    : await detectEngine({
        purpose: "dispatch",
        allowedEngines: managedPolicy.allowedEngines,
      });
  const runner = options.runner ?? detection?.runner;
  if (!runner) {
    throw new Error("No authenticated agent engine is available");
  }

  const runId = options.runId ?? crypto.randomUUID();
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(runId)) {
    throw new Error("Invalid run id");
  }
  const slug = "task";
  const branch = `shadowclone/${slug}-${runId.slice(0, 8)}`;
  const worktree = await createWorktree({
    targetDirectory,
    worktreeDirectory: paths.worktreeDirectory(runId),
    branch,
    runner: options.commandRunner,
  });
  const compiledProfilePath = path.join(
    paths.runDirectory(runId),
    "profile.md",
  );
  const compilation = await compileProfile({
    input: {
      kind: "directory",
      profileDirectory: paths.profileDirectory,
      origin: repository.origin,
      targetRepo: repository.profileFileName,
    },
    outputPath: compiledProfilePath,
  });
  const startedAt = options.startedAt ?? new Date().toISOString();
  const run = await runner({
    prompt: [
      options.task,
      "",
      "Work only in this worktree. Leave the finished change uncommitted.",
      "Do not merge or force push under any circumstance.",
      ...(needsRemoteDraft
        ? [
            "Return a JSON title and body for the approved PR action. The host will perform it for the approved repository.",
          ]
        : []),
    ].join("\n"),
    cwd: worktree.worktreeDirectory,
    execution: {
      purpose: "dispatch",
      allowedDomains: [],
      blockedPaths: [worktree.repoDirectory, paths.shadowcloneDirectory],
      repositoryDirectory: worktree.repoDirectory,
    },
    systemPromptFile: compiledProfilePath,
    sessionId: runId,
    allowedTools: dispatchPolicy.allowedTools,
    disallowedTools: dispatchPolicy.disallowedTools,
    permissionMode: dispatchPolicy.permissionMode,
    maxBudgetUsd: dispatchPolicy.maxBudgetUsd,
    ...(needsRemoteDraft
      ? { outputSchema: z.toJSONSchema(remoteDraftSchema) }
      : {}),
  });
  if (!run.isError) {
    await commitWorktree({ worktree, runner: options.commandRunner });
  }
  const inspection = await inspectWorktree({
    worktree,
    runner: options.commandRunner,
  });
  const actionsTaken: string[] =
    inspection.commits.length > 0 ? ["commit"] : [];
  if (
    !run.isError &&
    dispatchPolicy.grantedActions.includes("push") &&
    inspection.commits.length > 0
  ) {
    await pushWorktree({
      worktree,
      repositoryId: repository.id,
      runner: options.commandRunner,
    });
    actionsTaken.push("push");
  }
  if (!run.isError) {
    actionsTaken.push(
      ...(await executeRemoteActions({
        granted: dispatchPolicy.grantedActions,
        repositoryId: repository.id,
        worktree,
        runDirectory: paths.runDirectory(runId),
        structured: run.structured,
        pullRequestNumber: options.pullRequestNumber,
        runner: options.commandRunner,
      })),
    );
  }
  const receipt = runReceipt({
    runId,
    task: options.task,
    repositoryId: repository.id,
    branch,
    run,
    startedAt,
    inspection,
    actionsTaken,
    blockedActions: dispatchPolicy.blockedActions,
    profileRulesApplied: compilation.appliedRuleCount,
  });
  await writeReceipt({ runDirectory: paths.runDirectory(runId), receipt });
  if (run.isError) {
    throw new Error("Clone run did not finish cleanly; review its receipt");
  }
  return receipt;
}
