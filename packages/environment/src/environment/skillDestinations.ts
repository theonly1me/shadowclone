import path from "node:path";
import type { DiscoveredSkill } from "@shadowclone/skills";
import { skillDirectories, type LearningScope } from "./scope";
import type { EnvironmentState, LearningRecord } from "./types";

export async function skillDestinations(options: {
  readonly scope: LearningScope;
  readonly skill: DiscoveredSkill | null;
  readonly name: string;
}): Promise<readonly string[]> {
  const copies = skillDirectories(options.scope).map((directory) =>
    path.join(directory, options.name, "SKILL.md"),
  );
  const editsExistingRepositorySkill =
    options.scope.repository !== null && options.skill?.root.owner === "user";
  const existingCopies = editsExistingRepositorySkill
    ? (await Promise.all(copies.map(async (filePath) => ((await Bun.file(filePath).exists()) ? [filePath] : [])))).flat()
    : copies;

  return [
    ...new Set([
      ...existingCopies,
      ...(options.skill?.root.owner === "user"
        ? [path.join(options.skill.root.directory, options.skill.relativePath)]
        : []),
    ]),
  ];
}

export function activeLearningKeys(options: {
  readonly state: EnvironmentState;
  readonly records: readonly LearningRecord[];
}): ReadonlySet<string> {
  const retiring = new Set(options.records.filter((record) => record.retirementRequested).map(({ rule }) => rule.key));

  return new Set(options.state.records
    .filter((record) => !record.retirementRequested && !retiring.has(record.rule.key))
    .map(({ rule }) => rule.key));
}
