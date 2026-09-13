import { readEffectiveConfig } from "../config";
import { projectPaths, type ProjectPaths } from "../paths";
import { learningInterval, readLearningState } from "./state";

function spawnLearningWorker(options: {
  readonly paths: ProjectPaths;
  readonly sessionKeys: readonly string[];
}): void {
  const worker = Bun.spawn({
    cmd: [
      process.execPath,
      Bun.main,
      "learn",
      "--automatic",
      ...options.sessionKeys.flatMap((key) => ["--session-key", key]),
    ],
    cwd: options.paths.shadowcloneDirectory,
    stdin: "ignore", stdout: "ignore", stderr: "ignore", detached: true,
    env: { ...process.env, SHADOWCLONE_INTERNAL_RUN: "1" },
  });
  worker.unref();
}

export async function scheduleLearning(options: {
  readonly paths?: ProjectPaths;
  readonly managedConfigPath?: string | null;
  readonly now?: number;
  readonly sessionKeys?: readonly string[];
  readonly internalRun?: boolean;
  readonly spawn?: (options: {
    readonly paths: ProjectPaths;
    readonly sessionKeys: readonly string[];
  }) => void;
} = {}): Promise<boolean> {
  if (options.internalRun ?? process.env.SHADOWCLONE_INTERNAL_RUN === "1") return false;
  const paths = options.paths ?? projectPaths;
  const { config, policy } = await readEffectiveConfig({ configPath: paths.configFile, managedConfigPath: options.managedConfigPath === undefined ? paths.managedConfigFile : options.managedConfigPath });
  if (!config.distillation.deep || !config.distillation.automatic || policy.distillation !== "allowed") return false;
  const state = await readLearningState(paths);
  const sessionKeys = options.sessionKeys ?? [];
  if (sessionKeys.length === 0 && state.lastAttemptAt !== null && (options.now ?? Date.now()) - state.lastAttemptAt < learningInterval) return false;
  (options.spawn ?? spawnLearningWorker)({ paths, sessionKeys });
  return true;
}
