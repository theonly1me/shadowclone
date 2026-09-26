import type { SourceId } from "../config";
import { readEffectiveConfig } from "../config";
import { openEventIndex } from "../index";
import { resolveRepository } from "../signal";
import type { Integration, IntegrationOptions } from "./types";

const sourceByAgent: Readonly<Record<Integration["agent"], SourceId>> = {
  "claude-code": "claude-code",
  codex: "codex",
  cursor: "cursor",
  antigravity: "antigravity",
};

export function nativeBindingTimestamp(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 10_000_000_000 ? value * 1_000 : value;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Date.now();
}

export async function bindNativeSessionOrigin(options: IntegrationOptions & {
  readonly integration: Integration;
  readonly sessionId: string;
  readonly cwd: string;
  readonly timestamp: number;
}): Promise<void> {
  const paths = options.paths;
  if (paths === undefined) throw new Error("Session binding requires project paths");
  const { config, policy } = await readEffectiveConfig({
    configPath: options.configPath ?? paths.configFile,
    managedConfigPath: options.managedConfigPath === undefined
      ? paths.managedConfigFile
      : options.managedConfigPath,
  });
  if (!policy.enabled || !config.sources["git-metadata"]) return;
  const repository = await resolveRepository({
    cwd: options.cwd,
    enabled: true,
    readRemote: options.readRemote,
  });
  const index = await openEventIndex(paths.indexDatabase);
  try {
    index.bindSessionOrigin({
      source: sourceByAgent[options.integration.agent],
      sessionId: options.sessionId,
      timestamp: options.timestamp,
      repository,
    });
  } finally {
    index.close();
  }
}
