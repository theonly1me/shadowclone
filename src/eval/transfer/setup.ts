import path from "node:path";
import { readEffectiveConfig } from "../../config";
import { detectEngine } from "../../engine";
import { projectPaths } from "../../paths";
import { isOriginBlocked, resolveRepository } from "../../signal";
import {
  defaultRepeat,
  defaultTaskCount,
  defaultTimeoutSeconds,
  invocationCeiling,
} from "./budget";
import { command } from "./command";
import { resolveEvaluationLocation } from "./location";
import { validateResumeOptions } from "./resume";
import type { TransferOptions } from "./types";
import { positiveInteger, type ResolvedTransferSetup } from "./setupOptions";

export type { ResolvedTransferSetup } from "./setupOptions";

export async function setupTransferEval(
  options: TransferOptions = {},
): Promise<ResolvedTransferSetup> {
  const paths = options.paths ?? projectPaths;
  const { config, policy } = await readEffectiveConfig({
    configPath: paths.configFile,
    managedConfigPath: paths.managedConfigFile,
  });

  if (!policy.enabled) {
    throw new Error("Shadowclone is disabled by managed policy");
  }

  if (!config.sources["git-metadata"]) {
    throw new Error("Repository eval requires git-metadata consent");
  }

  if (policy.distillation !== "allowed" || !config.distillation.deep) {
    throw new Error("Evaluation requires permitted deep distillation");
  }

  const repository = await command({
    arguments: ["git", "rev-parse", "--show-toplevel"],
    cwd: path.resolve(options.repo ?? process.cwd()),
  });
  const repositoryIdentity = await resolveRepository({
    cwd: repository,
    enabled: true,
  });

  if (
    isOriginBlocked({
      repository: repositoryIdentity,
      patterns: policy.blockedOrigins,
    })
  ) {
    throw new Error("Managed policy blocks this repository");
  }

  const location = await resolveEvaluationLocation({
    paths,
    requestedId: options.evalId,
  });

  if (location.saved) {
    validateResumeOptions({
      receipt: location.saved,
      requested: options,
      repository,
      commit: await command({
        arguments: ["git", "rev-parse", "HEAD"],
        cwd: repository,
      }),
    });
  }

  const requestedEngine = options.engine ?? location.saved?.prepared.engine;

  if (requestedEngine && !policy.allowedEngines.includes(requestedEngine)) {
    throw new Error("Managed policy blocks this engine");
  }

  const detection = await detectEngine({
    purpose: "eval",
    allowedEngines: requestedEngine ? [requestedEngine] : policy.allowedEngines,
  });
  const engine = requestedEngine ?? detection.selectedEngine;
  const runner = options.runner ?? detection.runner;

  if (!runner || !engine || !["codex", "claude-code"].includes(engine)) {
    throw new Error("No authenticated evaluation engine available");
  }

  const count = positiveInteger({
    value: options.task ? 1 : options.tasks,
    fallback: location.saved?.prepared.tasks.length ?? defaultTaskCount,
    name: "tasks",
  });

  if (count > 10) {
    throw new Error("tasks cannot exceed 10");
  }

  const repeat = positiveInteger({
    value: options.repeat,
    fallback: location.saved?.prepared.repeat ?? defaultRepeat,
    name: "repeat",
  });
  const maximumCalls = invocationCeiling({ tasks: count, repeat });
  const maxCalls = positiveInteger({
    value: options.maxCalls,
    fallback: location.saved?.prepared.maxCalls ?? maximumCalls,
    name: "max-calls",
  });

  if (maxCalls > maximumCalls) {
    throw new Error(
      "max-calls cannot exceed the evaluation invocation ceiling",
    );
  }

  return {
    paths,
    config,
    policy,
    repository,
    repositoryIdentity,
    evalId: location.evalId,
    directory: location.directory,
    saved: location.saved,
    engine,
    runner,
    model:
      options.model ??
      location.saved?.prepared.model ??
      (engine === "codex" ? "gpt-5.6-sol" : "sonnet"),
    reasoningEffort:
      options.reasoningEffort ??
      location.saved?.prepared.reasoningEffort ??
      undefined,
    count,
    repeat,
    timeoutSeconds: positiveInteger({
      value: options.timeoutSeconds,
      fallback:
        location.saved?.prepared.timeoutSeconds ?? defaultTimeoutSeconds,
      name: "timeout-seconds",
    }),
    maxBudgetUsd:
      options.maxBudgetUsd ??
      location.saved?.prepared.maxBudgetUsd ??
      undefined,
    maxCalls,
    suppliedTask: options.task,
    taskFile: options.taskFile,
    suiteId: options.suiteId,
  };
}
