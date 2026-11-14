import { rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  applyManagedPolicy,
  projectPaths,
  readConfig,
  readEffectiveConfig,
  setLiveSessionsEnabled,
  setTaskBriefsEnabled,
  writeConfig,
} from "@shadowclone/core";
import { removeBriefFiles } from "./files";
import { installLiveHooks } from "./install";
import type { LivePaths } from "./paths";

type ConfigLocation = { readonly configPath?: string; readonly managedConfigPath?: string | null };

export type LiveConsent = { readonly liveSessions: boolean; readonly taskBriefs: boolean };

export type TaskBriefsSwitch =
  | { readonly kind: "on" }
  | { readonly kind: "off"; readonly removedSessions: number }
  | { readonly kind: "refused"; readonly reason: string };

function effectiveConfig(options: ConfigLocation) {
  return readEffectiveConfig({
    configPath: options.configPath ?? projectPaths.configFile,
    managedConfigPath:
      options.managedConfigPath === undefined
        ? projectPaths.managedConfigFile
        : options.managedConfigPath,
  });
}

export async function liveConsent(options: ConfigLocation = {}): Promise<LiveConsent> {
  const { config } = await effectiveConfig(options);

  return {
    liveSessions: config.remote?.liveSessions === true,
    taskBriefs: config.remote?.taskBriefs === true,
  };
}

export async function liveSessionsEnabled(options: ConfigLocation = {}): Promise<boolean> {
  return (await liveConsent(options)).liveSessions;
}

export async function switchTaskBriefs(
  options: ConfigLocation & { readonly paths: LivePaths; readonly enabled: boolean },
): Promise<TaskBriefsSwitch> {
  const configPath = options.configPath ?? projectPaths.configFile;
  const config = setTaskBriefsEnabled({ config: await readConfig({ configPath }), enabled: options.enabled });

  if (options.enabled) {
    const { policy } = await effectiveConfig(options);
    const effective = applyManagedPolicy({ config, policy }).remote;

    if (effective?.liveSessions !== true) {
      return {
        kind: "refused",
        reason: "Live sessions are off, so task briefs cannot start. Run shadowclone live enable first.",
      };
    }

    if (!effective.taskBriefs) {
      return { kind: "refused", reason: "A managed policy keeps task briefs off on this machine." };
    }
  }

  await writeConfig({ configPath, config });

  return options.enabled
    ? { kind: "on" }
    : { kind: "off", removedSessions: await removeBriefFiles(options.paths) };
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
