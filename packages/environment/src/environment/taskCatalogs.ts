import type { FileUpdate } from "@shadowclone/changes";
import { fingerprint, readLocalText } from "@shadowclone/core";
import { publishedSkills, renderTaskCatalog, taskCatalogPath } from "./catalog";
import type { LearningScope } from "./scope";
import type { EnvironmentState } from "./types";

export async function publishTaskCatalogs(options: {
  readonly state: EnvironmentState;
  readonly scopes: readonly LearningScope[];
}): Promise<{ readonly state: EnvironmentState; readonly updates: readonly FileUpdate[] }> {
  const artifacts = [...options.state.artifacts];
  const updates: FileUpdate[] = [];
  for (const scope of options.scopes) {
    const skills = publishedSkills({ state: options.state, scopes: new Set([scope.key]) }).filter(
      ({ name }) => name !== "shadowclone-baseline",
    );
    const filePath = taskCatalogPath(scope);
    const tracked = artifacts.find((artifact) => artifact.filePath === filePath);
    if (skills.length === 0 && !tracked) continue;
    const previous = await readLocalText(filePath);
    if (previous !== null && fingerprint(previous) !== tracked?.fingerprint) {
      throw new Error(
        `The task guidance catalog changed at ${filePath}; shadowclone preserved it.`,
      );
    }
    const next = skills.length > 0 ? renderTaskCatalog(skills) : null;
    if (previous !== next) updates.push({ filePath, previous, next });
    const position = artifacts.findIndex((artifact) => artifact.filePath === filePath);
    if (position >= 0) artifacts.splice(position, 1);
    if (next !== null)
      artifacts.push({
        filePath,
        fingerprint: fingerprint(next),
        original: null,
        kind: "resource",
        scope: scope.key,
        name: "shadowclone-guidance",
        description: "Task-specific learned skill catalog",
        learningKeys: [...new Set(skills.flatMap((skill) => skill.learningKeys))],
      });
  }
  return { state: { ...options.state, artifacts }, updates };
}
