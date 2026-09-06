import { mkdir } from "node:fs/promises";
import path from "node:path";
import { projectPaths } from "../paths";
import toml from "smol-toml";
import {
  applyManagedPolicy,
  readManagedPolicy,
  type ManagedPolicy,
} from "./managed";
import {
  defaultConfig,
  parseConfig,
  type ShadowcloneConfig,
  type SourceId,
} from "./schema";

export {
  defaultConfig,
  sourceIds,
  type ShadowcloneConfig,
  type SourceId,
  type SourceSettings,
} from "./schema";
export {
  applyManagedPolicy,
  defaultManagedPolicy,
  engineIds,
  parseManagedPolicy,
  readManagedPolicy,
  type ActionTier,
  type DistillationPolicy,
  type ManagedPolicy,
} from "./managed";
export {
  actionCapabilities,
  type ActionCapability,
  type RepoPolicy,
  type RepoSettings,
} from "./repo";

export async function readConfig(
  options: { readonly configPath?: string } = {},
): Promise<ShadowcloneConfig> {
  const configPath = options.configPath ?? projectPaths.configFile;
  const configFile = Bun.file(configPath);

  if (!(await configFile.exists())) {
    return defaultConfig;
  }

  const parsed: unknown = toml.parse(await configFile.text());
  return parseConfig(parsed);
}

export async function readEffectiveConfig(options: {
  readonly configPath?: string;
  readonly managedConfigPath?: string | null;
} = {}): Promise<{
  readonly config: ShadowcloneConfig;
  readonly policy: ManagedPolicy;
}> {
  const policy = await readManagedPolicy(
    options.managedConfigPath === undefined
      ? projectPaths.managedConfigFile
      : options.managedConfigPath,
  );
  const config = policy.enabled
    ? await readConfig({ configPath: options.configPath })
    : defaultConfig;
  return {
    config: applyManagedPolicy({ config, policy }),
    policy,
  };
}

export function renderConfig(config: ShadowcloneConfig): string {
  const document: Record<string, unknown> = {
    "schema-version": config.schemaVersion,
    sources: config.sources,
    distillation: config.distillation,
  };

  if (Object.keys(config.repo).length > 0) {
    document.repo = config.repo;
  }

  return toml.stringify(document);
}

export async function writeConfig(options: {
  readonly config: ShadowcloneConfig;
  readonly configPath?: string;
}): Promise<void> {
  const configPath = options.configPath ?? projectPaths.configFile;

  await mkdir(path.dirname(configPath), { recursive: true });
  await Bun.write(configPath, renderConfig(options.config));
}

export function setSourceEnabled(options: {
  readonly config: ShadowcloneConfig;
  readonly source: SourceId;
  readonly enabled: boolean;
}): ShadowcloneConfig {
  return {
    ...options.config,
    sources: {
      ...options.config.sources,
      [options.source]: options.enabled,
    },
  };
}

export function setDeepEnabled(options: {
  readonly config: ShadowcloneConfig;
  readonly enabled: boolean;
}): ShadowcloneConfig {
  return {
    ...options.config,
    distillation: { deep: options.enabled },
  };
}
