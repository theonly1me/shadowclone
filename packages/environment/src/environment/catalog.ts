import path from "node:path";
import { skillDirectories, type LearningScope } from "./scope";
import type { EnvironmentArtifact, EnvironmentState } from "./types";

export function publishedSkills(options: {
  readonly state: EnvironmentState;
  readonly scopes: ReadonlySet<string>;
}): readonly EnvironmentArtifact[] {
  const skills = new Map<string, EnvironmentArtifact>();

  for (const artifact of options.state.artifacts) {
    if (artifact.kind !== "skill" || artifact.buildId || !options.scopes.has(artifact.scope)) {
      continue;
    }

    const key = `${artifact.scope}/${artifact.name}`;

    if (!skills.has(key) || artifact.filePath.includes("/.agents/skills/")) {
      skills.set(key, artifact);
    }
  }

  return [...skills.values()];
}

export function taskCatalogPath(scope: LearningScope): string {
  const [directory] = skillDirectories(scope);
  if (!directory) throw new Error("A guidance catalog needs a skill directory");
  return path.join(directory, "shadowclone-guidance", "catalog.md");
}

export function taskCatalogInstruction(filePath: string): string {
  return `Before task work, read ${filePath} and load every skill whose description matches the task. If the catalog is missing, run shadowclone sync, then read it.`;
}

export function renderTaskCatalog(
  skills: readonly {
    readonly name: string;
    readonly description: string;
    readonly filePath: string;
  }[],
): string {
  const text = [
    "# Task guidance catalog",
    "",
    "Select skills for the current task. Read every matching skill before acting. The current request takes precedence over learned defaults.",
    ...skills.flatMap((skill) => [
      "",
      `## ${skill.name}`,
      "",
      skill.description,
      "",
      `Read: \`${skill.filePath}\`.`,
    ]),
    "",
  ].join("\n");
  if (Buffer.byteLength(text) > 512_000)
    throw new Error("The task guidance catalog exceeds its 512 KB limit");
  return text;
}
