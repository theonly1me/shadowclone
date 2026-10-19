import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  projectPaths,
  readConfig,
  readEffectiveConfig,
  setLiveSessionsEnabled,
  writeConfig,
} from "@shadowclone/core";
import { installLiveHooks } from "./install";
import type { LivePaths } from "./paths";

export async function liveSessionsEnabled(
  options: { readonly configPath?: string; readonly managedConfigPath?: string | null } = {},
): Promise<boolean> {
  const { config } = await readEffectiveConfig({
    configPath: options.configPath ?? projectPaths.configFile,
    managedConfigPath:
      options.managedConfigPath === undefined
        ? projectPaths.managedConfigFile
        : options.managedConfigPath,
  });

  return config.remote?.liveSessions === true;
}

export function liveLauncher(home: string): string {
  const launcher = path.join(home, ".shadowclone", "bin", "shadowclone");

  return existsSync(launcher)
    ? 'sh "$HOME/.shadowclone/bin/shadowclone"'
    : JSON.stringify(Bun.which("shadowclone") ?? "shadowclone");
}

export async function switchLiveSessions(options: {
  readonly paths: LivePaths;
  readonly enabled: boolean;
  readonly configPath?: string;
}): Promise<{ readonly changed: readonly string[]; readonly skipped: readonly string[] }> {
  const configPath = options.configPath ?? projectPaths.configFile;
  const config = await readConfig({ configPath });
  const hooks = await installLiveHooks({
    home: options.paths.home,
    launcher: liveLauncher(options.paths.home),
    remove: !options.enabled,
  });

  await writeConfig({
    configPath,
    config: setLiveSessionsEnabled({ config, enabled: options.enabled }),
  });

  if (!options.enabled) {
    await rm(options.paths.directory, { recursive: true, force: true });
  }

  return hooks;
}
