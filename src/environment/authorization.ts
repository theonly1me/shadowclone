import path from "node:path";
import type { ProjectPaths } from "../paths";
import { canonicalPath } from "../paths";
import { readIntegrations } from "../integrations/state";
import { integrationFilePath } from "../integrations/targets";
import { readMaintenanceState } from "../skillMaintenance/state";
import { readEnvironment, environmentFile } from "./store";
import { learningScopes, skillDirectories } from "./scope";

export async function authorizedEnvironmentTarget(options: { readonly paths: ProjectPaths; readonly filePath: string }): Promise<boolean> {
  const target = path.resolve(options.filePath);
  if (target === environmentFile(options.paths)) return true;
  if (target === path.join(options.paths.shadowcloneDirectory, "integrations.json")) return true;
  const state = await readEnvironment(options.paths);
  if (state === null) return false;
  const roots = learningScopes({ paths: options.paths, state }).flatMap(skillDirectories);
  const maintenance = await readMaintenanceState(options.paths);
  roots.push(...maintenance.roots.filter((root) => root.enabled && root.owner === "user").map((root) => root.directory));
  if (roots.some((root) => {
    const relative = path.relative(canonicalPath(root), target).split(path.sep).join("/");
    return /^[a-z0-9]+(?:-[a-z0-9]+)*\/.+/.test(relative) && !relative.split("/").some((segment) => segment === ".." || segment === ".git");
  })) return true;
  if (state.repositories.some(({ directory }) => ["AGENTS.md", "CLAUDE.md"].some((name) => path.join(directory, name) === target))) return true;
  return (await readIntegrations(options.paths)).some((integration) => integration.files.some((file) => integrationFilePath({ integration, file }) === target));
}
