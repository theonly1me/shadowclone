import { mkdir } from "node:fs/promises";
import path from "node:path";
import { projectPaths } from "../paths";
import {
  defaultConfig,
  parseConfig,
  sourceIds,
  type ShadowcloneConfig,
} from "./schema";

export {
  defaultConfig,
  sourceIds,
  type ShadowcloneConfig,
  type SourceId,
  type SourceSettings,
} from "./schema";

export async function readConfig(
  options: { readonly configPath?: string } = {},
): Promise<ShadowcloneConfig> {
  const configPath = options.configPath ?? projectPaths.configFile;
  const configFile = Bun.file(configPath);

  if (!(await configFile.exists())) {
    return defaultConfig;
  }

  const parsed: unknown = Bun.TOML.parse(await configFile.text());
  return parseConfig(parsed);
}

export function renderConfig(config: ShadowcloneConfig): string {
  const sourceLines = sourceIds.map(
    (sourceId) => `${sourceId} = ${config.sources[sourceId]}`,
  );

  return [
    `schema-version = ${config.schemaVersion}`,
    "",
    "[sources]",
    ...sourceLines,
    "",
    "[distillation]",
    `deep = ${config.distillation.deep}`,
    "",
  ].join("\n");
}

export async function writeConfig(options: {
  readonly config: ShadowcloneConfig;
  readonly configPath?: string;
}): Promise<void> {
  const configPath = options.configPath ?? projectPaths.configFile;

  await mkdir(path.dirname(configPath), { recursive: true });
  await Bun.write(configPath, renderConfig(options.config));
}
