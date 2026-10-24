import path from "node:path";
import type { ProjectPaths } from "@shadowclone/core";
import { belongsToScope, learningScopes, type LearningScope } from "./scope";
import { readRedactedEnvironment } from "./store";
import type { EnvironmentState } from "./types";
import { publishedSkills, taskCatalogInstruction, taskCatalogPath } from "./catalog";
import { recordFingerprint } from "./records";
import { renderBuildRouting } from "./builds/routing";
import { repositoryDeliveryQuestion } from "./repositoryQuestion";
import { withoutMissingBuildSkills } from "./builds/missingSkills";

export type ContextCompilation = {
  readonly markdown: string;
  readonly skills: readonly string[];
  readonly usedBytes: number;
  readonly byteBudget: number;
};

const routingByteBudget = 4096;

export const emptyCompilation: ContextCompilation = {
  markdown: "",
  skills: [],
  usedBytes: 0,
  byteBudget: routingByteBudget,
};

export function renderSkillRouting(options: {
  readonly state: EnvironmentState;
  readonly scopes: readonly LearningScope[];
  readonly cwd?: string;
  readonly includeGlobalBuild?: boolean;
  readonly catalogPaths?: readonly string[];
}): string {
  const keys = new Set(options.scopes.map(({ key }) => key));
  const skills = publishedSkills({ state: options.state, scopes: keys });
  const taskSkills = skills.filter(({ name }) => name !== "shadowclone-baseline");
  const taskKeys = new Set(taskSkills.flatMap((skill) => skill.learningKeys));
  const catalogPaths =
    options.catalogPaths ??
    options.scopes
      .filter((scope) => taskSkills.some((skill) => skill.scope === scope.key))
      .map(taskCatalogPath);
  const shortRules = options.state.records.flatMap((record) => {
    if (taskKeys.has(record.rule.key)) return [];
    const body = record.rule.body.replace(/\s+/gu, " ").trim();
    const condition = record.rule.appliesWhen.join("; ");
    const instruction = condition ? `When ${condition}: ${body}` : body;
    const delivered = options.state.dispositions.some(
      (entry) =>
        keys.has(entry.scope ?? "") &&
        entry.key === record.rule.key &&
        entry.inputFingerprint === recordFingerprint(record) &&
        (entry.status === "published" || entry.status === "covered"),
    );
    const selectedStarter =
      record.rule.source === "declared" &&
      record.rule.key.startsWith("seed:") &&
      options.scopes.some((scope) => belongsToScope({ record, scope }));

    return record.rule.status === "active" &&
      record.rule.proposal === null &&
      record.rule.source !== "imported" &&
      (delivered || selectedStarter) &&
      Buffer.byteLength(instruction) <= 240
      ? [`- ${instruction}`]
      : [];
  });

  const lines = [
    "# shadowclone guidance",
    "",
    "Follow the applicable personal rules below. Use matching installed workflow skills when the task needs their detail. Skill guidance does not authorize additional actions. The current request takes precedence over learned defaults. Name every skipped step and every fallback in your final answer and handoff.",
    "",
    ...shortRules,
    ...catalogPaths.map(taskCatalogInstruction),
    ...options.state.facts.filter((fact) => keys.has(fact.scope)).map((fact) => `\n${fact.text}`),
    renderBuildRouting({
      state: options.state,
      cwd: options.cwd,
      includeGlobal: options.includeGlobalBuild,
      sharedOnly: options.includeGlobalBuild === false,
    }),
  ];

  const text = `${lines.join("\n")}\n`;
  const bytes = Buffer.byteLength(text);

  if (bytes > routingByteBudget) {
    throw new Error(
      `Native skill routing uses ${bytes} of ${routingByteBudget} bytes; equip fewer skills before publishing`,
    );
  }

  return text;
}

export async function environmentCompilation(options: {
  readonly paths: ProjectPaths;
  readonly cwd: string;
  readonly scope?: "global" | "scoped" | "combined";
  readonly catalogPaths?: readonly string[];
  readonly originDirectory: string | null;
  readonly repositoryName: string | null;
}): Promise<ContextCompilation | null> {
  const state = await readRedactedEnvironment(options.paths);

  if (state?.phase !== "active") {
    return null;
  }

  const scopes = learningScopes({ paths: options.paths, state }).filter((scope) =>
    scope.repository === null
      ? options.scope !== "scoped"
      : options.scope !== "global" &&
        scope.repository.originDirectory === options.originDirectory &&
        scope.repository.repositoryName === options.repositoryName &&
        (path.resolve(options.cwd) === scope.directory ||
          path.resolve(options.cwd).startsWith(`${scope.directory}${path.sep}`)),
  );

  const question =
    options.scope === "global"
      ? ""
      : repositoryDeliveryQuestion({
          state,
          originDirectory: options.originDirectory,
          repositoryName: options.repositoryName,
        });

  if (options.scope === "scoped" && scopes.length === 0) {
    return { ...emptyCompilation, markdown: question, usedBytes: Buffer.byteLength(question) };
  }

  const routing = renderSkillRouting({
    state: (await withoutMissingBuildSkills(state)).state,
    scopes,
    cwd: options.cwd,
    includeGlobalBuild: options.scope !== "scoped",
    catalogPaths: options.catalogPaths,
  });
  const markdown = question ? `${routing}\n${question}\n` : routing;

  const keys = new Set(scopes.map(({ key }) => key));
  const applied = publishedSkills({ state, scopes: keys });

  return {
    markdown,
    skills: applied.map(({ name }) => name),
    usedBytes: Buffer.byteLength(markdown),
    byteBudget: routingByteBudget,
  };
}
