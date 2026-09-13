import path from "node:path";
import { addGitExcludes, removeGitExcludes } from "../cli/installArtifacts";
import { canonicalPath, projectPaths } from "../paths";
import { compileContext } from "./compile";
import { applyIntegrationFiles, prepareIntegrationFiles } from "./files";
import { readIntegrations, saveIntegration } from "./state";
import type { Integration, IntegrationAgent, IntegrationOptions, IntegrationScope } from "./types";

export async function installIntegration(options: IntegrationOptions & {
  readonly agent: IntegrationAgent;
  readonly scope: IntegrationScope;
  readonly cwd?: string;
}): Promise<Integration> {
  const paths = options.paths ?? projectPaths;
  const cwd = canonicalPath(options.cwd ?? process.cwd());
  const home = path.dirname(paths.shadowcloneDirectory);
  const providerDirectory = options.agent === "claude-code"
    ? ".claude"
    : options.agent === "codex"
      ? ".codex"
      : options.agent === "cursor"
        ? ".cursor"
        : ".gemini/config";
  const directory = options.scope === "repository"
    ? cwd
    : canonicalPath(options.agent === "codex"
      ? path.dirname(paths.codexSessionsDirectory)
      : path.join(home, providerDirectory));
  const integrations = await readIntegrations(paths);
  const previous = integrations.find((entry) => entry.agent === options.agent && entry.scope === options.scope && entry.directory === directory);
  const integration: Integration = previous ?? {
    id: crypto.randomUUID(), agent: options.agent, scope: options.scope, directory,
    userDirectory: home,
    codexInstructions: options.agent === "codex" && await Bun.file(path.join(directory, "AGENTS.override.md")).exists() ? "AGENTS.override.md" : "AGENTS.md",
    files: [], excludes: [], deliveredAt: null,
  };
  const profile = await compileContext({ ...options, paths, cwd, scope: options.scope === "global" ? "global" : "combined" });
  if (profile === null) throw new Error("Managed policy blocks this integration");
  const changes = await prepareIntegrationFiles({ integration, profile });
  const updated = { ...integration, files: changes.map((change) => change.record) };
  await saveIntegration({ paths, integration: updated });
  try {
    await applyIntegrationFiles(changes);
  } catch (error) {
    await saveIntegration({ paths, integration, remove: previous === undefined });
    throw error;
  }
  const excludes = options.scope === "repository" ? await addGitExcludes({
    cwd, patterns: changes.filter((change) => change.record.created).map((change) => change.record.relativePath),
  }) : [];
  const installed = { ...updated, excludes: [...new Set([...updated.excludes, ...excludes])] };
  await saveIntegration({ paths, integration: installed });
  return installed;
}

export async function uninstallIntegration(options: {
  readonly integration: Integration;
  readonly paths?: IntegrationOptions["paths"];
}): Promise<void> {
  const paths = options.paths ?? projectPaths;
  const changes = await prepareIntegrationFiles({ integration: options.integration, profile: "", remove: true });
  await applyIntegrationFiles(changes);
  if (options.integration.scope === "repository") {
    await removeGitExcludes({ cwd: options.integration.directory, patterns: options.integration.excludes });
  }
  await saveIntegration({ paths, integration: options.integration, remove: true });
}
