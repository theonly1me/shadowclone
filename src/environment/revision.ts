import path from "node:path";
import { commitLocalChanges, type FileUpdate } from "../changes";
import type { ProjectPaths } from "../paths";
import { authorizedEnvironmentTarget } from "./authorization";

export async function publishEnvironmentRevision(options: { readonly paths: ProjectPaths; readonly updates: readonly FileUpdate[] }): Promise<string | null> {
  if (options.updates.length === 0) return null;
  let root = path.dirname(options.updates[0]?.filePath ?? options.paths.shadowcloneDirectory);
  for (const update of options.updates) {
    if (!await authorizedEnvironmentTarget({ paths: options.paths, filePath: update.filePath })) throw new Error("Environment change is outside authorized destinations");
    while (!path.resolve(update.filePath).startsWith(root === path.sep ? root : `${root}${path.sep}`)) root = path.dirname(root);
  }
  return commitLocalChanges({ paths: options.paths, root, kind: "environment", updates: options.updates });
}
