import { runReceipt } from "./runReceipt";
import { executeRemoteActions } from "./remoteActions";
import { createRunInvocation } from "./runInvocation";
import { readEffectiveConfig } from "../config";
import { detectEngine } from "../engine";
import { projectPaths } from "../paths";
import { isOriginBlocked, resolveRepository } from "../signal";
import { repairPrompt } from "./gate";
import { gateAndCommit } from "./gatedCommit";
import { resolveDispatchPolicy, validateRemoteGrants } from "./policy";
import { writeReceipt } from "./receipt";
import type { RunOptions, RunReceipt } from "./types";
import { detectVerificationTools } from "./verify";
import { inspectWorktree, pushWorktree } from "./worktree";
import { prepareRunWorkspace } from "./runWorkspace";

export async function runHeadlessClone(
  options: RunOptions,
): Promise<RunReceipt> {
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

  const { runId, branch, worktree, compiledProfilePath, compilation } =
    await prepareRunWorkspace({
      runId: options.runId,
      targetDirectory,
      paths,
      repository,
      commandRunner: options.commandRunner,
    });

  const startedAt = options.startedAt ?? new Date().toISOString();
  const invoke = createRunInvocation({
    runner,
    worktree,
    paths,
    compiledProfilePath,
    dispatchPolicy,
  });

  const firstRun = await invoke({
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
    sessionId: runId,
    schema: needsRemoteDraft,
  });

  const gated = firstRun.isError
    ? {
        run: firstRun,
        gate: { status: "not-run" as const, command: null, attempts: 0 },
      }
    : await gateAndCommit({
        worktree,
        run: firstRun,
        repair: (evidence) =>
          invoke({
            prompt: repairPrompt(evidence),
            sessionId: `${runId}-repair`,
            schema: false,
          }),
        blockedPaths: [paths.shadowcloneDirectory],
        execute: options.gateExecutor,
        runner: options.commandRunner,
      });
  const run = gated.run;

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
    gate: gated.gate,
  });

  await writeReceipt({ runDirectory: paths.runDirectory(runId), receipt });

  if (run.isError) {
    throw new Error("Clone run did not finish cleanly; review its receipt");
  }

  return receipt;
}
