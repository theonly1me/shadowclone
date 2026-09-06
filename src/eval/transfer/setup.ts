import { existsSync } from "node:fs";
import path from "node:path";
import {
  readEffectiveConfig,
  type ManagedPolicy,
  type ShadowcloneConfig,
} from "../../config";
import { detectEngine, type EngineId, type EngineRunner } from "../../engine";
import { projectPaths, type ProjectPaths } from "../../paths";
import { isOriginBlocked, resolveCwdOrigin } from "../../signal";
import { command } from "./command";
import { readReceipt } from "./resume";
import type { TransferOptions, TransferReceipt } from "./types";

export interface ResolvedTransferSetup {
  readonly paths: ProjectPaths;
  readonly config: ShadowcloneConfig;
  readonly policy: ManagedPolicy;
  readonly repository: string;
  readonly evalId: string;
  readonly directory: string;
  readonly saved: TransferReceipt | null;
  readonly engine: EngineId;
  readonly runner: EngineRunner;
  readonly model: string;
  readonly count: number;
  readonly repeat: number;
  readonly timeoutSeconds: number;
  readonly maxBudgetUsd: number | undefined;
  readonly since: number;
}

function parsePositiveInteger(options: {
  readonly value: number | undefined;
  readonly fallback: number;
  readonly name: string;
}): number {
  const value = options.value ?? options.fallback;

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${options.name} must be a positive integer`);
  }

  return value;
}

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
    throw new Error(
      "Repository eval requires consent for git-metadata in shadowclone init",
    );
  }

  if (policy.distillation !== "allowed" || !config.distillation.deep) {
    throw new Error("Automatic evaluation requires permitted deep distillation");
  }

  const repository = await command({
    arguments: ["git", "rev-parse", "--show-toplevel"],
    cwd: path.resolve(options.repo ?? process.cwd()),
  });

  const origin = await resolveCwdOrigin({ cwd: repository, enabled: true });
  if (
    isOriginBlocked({
      origin,
      cwd: repository,
      patterns: policy.blockedOrigins,
    })
  ) {
    throw new Error("Managed policy blocks this repository");
  }

  const evalId = options.evalId ?? crypto.randomUUID();
  const knownEvaluationIds = new Set<string>();
  const evalDirectory = path.join(paths.shadowcloneDirectory, "eval");

  if (existsSync(evalDirectory)) {
    const scanner = new Bun.Glob("*").scan({
      cwd: evalDirectory,
      onlyFiles: false,
    });
    for await (const entryName of scanner) {
      knownEvaluationIds.add(entryName);
    }
  }

  if (options.evalId && !knownEvaluationIds.has(options.evalId)) {
    throw new Error("Unknown evaluation id");
  }

  const directory = path.join(paths.shadowcloneDirectory, "eval", evalId);

  const saved = options.evalId
    ? readReceipt(
        await Bun.file(path.join(directory, "receipt.json")).text(),
      )
    : null;

  const requestedEngine = options.engine ?? saved?.prepared.engine;
  if (
    requestedEngine &&
    !policy.allowedEngines.includes(requestedEngine)
  ) {
    throw new Error("Managed policy blocks this engine");
  }

  const detection = await detectEngine({
    purpose: "eval",
    allowedEngines: requestedEngine
      ? [requestedEngine]
      : policy.allowedEngines,
  });

  const engine = requestedEngine ?? detection.selectedEngine;
  const runner = options.runner ?? detection.runner;

  if (
    !runner ||
    !engine ||
    !new Set(["codex", "claude-code"]).has(engine)
  ) {
    throw new Error("No authenticated evaluation engine available");
  }

  const model =
    options.model ??
    saved?.prepared.model ??
    (engine === "codex" ? "gpt-5.6-sol" : "sonnet");

  const count = parsePositiveInteger({
    value: options.tasks,
    fallback: 5,
    name: "tasks",
  });

  const repeat = parsePositiveInteger({
    value: options.repeat,
    fallback: saved?.prepared.repeat ?? 2,
    name: "repeat",
  });

  const timeoutSeconds = parsePositiveInteger({
    value: options.timeoutSeconds,
    fallback: saved?.prepared.timeoutSeconds ?? 600,
    name: "timeout-seconds",
  });

  const maxBudgetUsd =
    options.maxBudgetUsd ?? saved?.prepared.maxBudgetUsd ?? undefined;

  const since = options.since ? Date.parse(options.since) : 0;
  if (!Number.isFinite(since)) {
    throw new Error("Invalid --since date");
  }

  return {
    paths,
    config,
    policy,
    repository,
    evalId,
    directory,
    saved,
    engine,
    runner,
    model,
    count,
    repeat,
    timeoutSeconds,
    maxBudgetUsd,
    since,
  };
}
