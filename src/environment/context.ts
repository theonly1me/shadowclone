import path from "node:path";
import type { ProjectPaths } from "../paths";
import type { ProfileCompilation } from "../profile/compiler/types";
import { learningScopes, type LearningScope } from "./scope";
import { readRedactedEnvironment } from "./store";
import type { EnvironmentState } from "./types";
import { publishedSkills } from "./catalog";
import { renderBuildRouting } from "../builds/routing";

export function renderSkillRouting(options: {
  readonly state: EnvironmentState;
  readonly scopes: readonly LearningScope[];
  readonly cwd?: string;
  readonly includeGlobalBuild?: boolean;
}): string {
  const keys = new Set(options.scopes.map(({ key }) => key));
  const skills = publishedSkills({ state: options.state, scopes: keys });
  const baselines = skills.filter(
    ({ name }) => name === "shadowclone-baseline",
  );

  const lines = [
    "# Shadowclone skills",
    "",
    ...(baselines.length
      ? baselines.map(
          (baseline) =>
            `Before every task, read and follow the baseline skill at ${baseline.filePath}.`,
        )
      : ["Use the applicable installed skills before starting the task."]),
    "Load task skills when their descriptions match the request. Skill guidance does not authorize additional actions. The user's own skills and learned baseline rules take precedence over bundled workflow skills.",
    "",
    ...skills
      .filter(({ name }) => name !== "shadowclone-baseline")
      .map((skill) => `- ${skill.description} Read ${skill.filePath}.`),
    ...options.state.facts
      .filter((fact) => keys.has(fact.scope))
      .map((fact) => `\n${fact.text}`),
    renderBuildRouting({
      state: options.state,
      cwd: options.cwd,
      includeGlobal: options.includeGlobalBuild,
      sharedOnly: options.includeGlobalBuild === false,
    }),
  ];

  const text = `${lines.join("\n")}\n`;

  if (Buffer.byteLength(text) > 4096) {
    throw new Error(
      "Native skill routing exceeds 4 KiB; shorten descriptions or narrow routes before publishing",
    );
  }

  return text;
}

export async function environmentCompilation(options: {
  readonly paths: ProjectPaths;
  readonly cwd: string;
  readonly scope?: "global" | "scoped" | "combined";
  readonly originDirectory: string | null;
  readonly repositoryName: string | null;
}): Promise<ProfileCompilation | null> {
  const state = await readRedactedEnvironment(options.paths);

  if (state?.phase !== "active") {
    return null;
  }

  const scopes = learningScopes({ paths: options.paths, state }).filter(
    (scope) =>
      scope.repository === null
        ? options.scope !== "scoped"
        : options.scope !== "global" &&
          scope.repository.originDirectory === options.originDirectory &&
          scope.repository.repositoryName === options.repositoryName &&
          (path.resolve(options.cwd) === scope.directory ||
            path
              .resolve(options.cwd)
              .startsWith(`${scope.directory}${path.sep}`)),
  );

  const markdown = renderSkillRouting({
    state,
    scopes,
    cwd: options.cwd,
    includeGlobalBuild: options.scope !== "scoped",
  });

  const keys = new Set(scopes.map(({ key }) => key));
  const applied = publishedSkills({ state, scopes: keys });

  return {
    markdown,
    appliedRuleKeys: [],
    appliedRuleCount: 0,
    appliedReferenceKeys: applied.map(({ name }) => name),
    appliedReferenceCount: applied.length,
    usedBytes: Buffer.byteLength(markdown),
    byteBudget: 4096,
    breakdown: [],
    omissions: [],
  };
}
