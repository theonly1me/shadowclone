import { readEffectiveConfig } from "@shadowclone/core";
import { readEnvironment } from "../environment/store";
import { emptyEnvironment, type EnvironmentState } from "../environment/types";
import type { BuildContext } from "../environment/builds/definition";

export async function prepareBuildEnvironment(
  context: BuildContext,
): Promise<EnvironmentState> {
  const { policy } = await readEffectiveConfig({
    configPath: context.paths.configFile,
    managedConfigPath: context.paths.managedConfigFile,
  });

  if (!policy.enabled) {
    throw new Error("Managed policy disables build changes");
  }

  const initial = await readEnvironment(context.paths);

  if (initial?.phase === "preparing") {
    throw new Error(
      "Finish the pending skills migration before applying a build",
    );
  }

  if (initial !== null) {
    return initial;
  }

  const legacyFiles = await Array.fromAsync(
    new Bun.Glob("{global,org}/**/*.md").scan({
      cwd: context.paths.profileDirectory,
      onlyFiles: true,
    }),
  ).catch(() => []);

  if (legacyFiles.length > 0) {
    throw new Error(
      "Migrate the existing profile to skills before applying a visual build",
    );
  }

  return { ...emptyEnvironment, phase: "active" };
}
