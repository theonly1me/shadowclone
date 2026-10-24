import path from "node:path";
import { fingerprint, type ProjectPaths, type ShadowcloneConfig } from "@shadowclone/core";
import { globalInstructionFiles } from "@shadowclone/environment";
import { materializeSnapshot } from "@shadowclone/redact";
import { discoverDeliverySkills, readMaintenanceState } from "@shadowclone/skills";
import type { CoveredGuidance } from "../distill";
import { coverageRepositories, type CoverageRepository } from "./coverageRepositories";

const maximumInstructionBytes = 32_000;

async function readInstructionCoverage(options: {
  readonly homeDirectory: string;
  readonly repositories: readonly CoverageRepository[];
}): Promise<readonly CoveredGuidance[]> {
  const locations = [
    ...globalInstructionFiles.map((relativePath) => ({
      filePath: path.join(options.homeDirectory, relativePath),
      root: options.homeDirectory,
      source: `~/${relativePath}`,
      repository: undefined,
    })),
    ...options.repositories.flatMap((repository) =>
      ["AGENTS.md", "AGENTS.override.md", "CLAUDE.md"].map((name) => ({
        filePath: path.join(repository.directory, name),
        root: repository.directory,
        source: `repository ${name}`,
        repository: {
          originDirectory: repository.originDirectory,
          repositoryName: repository.repositoryName,
        },
      })),
    ),
  ];
  const coverage: CoveredGuidance[] = [];
  for (const location of locations) {
    const snapshot = await materializeSnapshot({
      filePath: location.filePath,
      roots: [location.root],
      maximumBytes: maximumInstructionBytes,
      parse: () => null,
    });
    const text = snapshot?.redacted.trim() ?? "";
    if (text)
      coverage.push({
        source: location.source,
        text,
        ...(location.repository ? { repository: location.repository } : {}),
      });
  }
  return coverage;
}

async function readSkillCoverage(options: {
  readonly paths: ProjectPaths;
  readonly repositories: readonly CoverageRepository[];
}): Promise<readonly CoveredGuidance[]> {
  const maintenance = await readMaintenanceState(options.paths);
  const roots = maintenance.roots.filter(
    (root) =>
      root.enabled &&
      root.owner === "user" &&
      (root.scope === "global" ||
        options.repositories.some((repository) => repository.directory === root.cwd)),
  );
  const discovered = await discoverDeliverySkills(roots);
  return discovered.skills.map((skill) => {
    const repository =
      skill.root.scope === "repository"
        ? options.repositories.find((entry) => entry.directory === skill.root.cwd)
        : undefined;
    return {
      source: `${repository ? "repository" : "personal"} skill ${skill.name}`,
      text: skill.redacted,
      ...(repository
        ? {
            repository: {
              originDirectory: repository.originDirectory,
              repositoryName: repository.repositoryName,
            },
          }
        : {}),
    };
  });
}

export async function readCoveredGuidance(options: {
  readonly paths: ProjectPaths;
  readonly config: ShadowcloneConfig;
  readonly blockedOrigins?: readonly string[];
}): Promise<readonly CoveredGuidance[]> {
  const { config, paths } = options;
  if (!config.sources["agent-context"] && !config.sources["skill-library"]) return [];
  const repositories = await coverageRepositories(options);
  const coverage = [
    ...(config.sources["agent-context"]
      ? await readInstructionCoverage({
          homeDirectory: path.dirname(paths.shadowcloneDirectory),
          repositories,
        })
      : []),
    ...(config.sources["skill-library"] ? await readSkillCoverage({ paths, repositories }) : []),
  ];
  return [
    ...new Map(
      coverage.map((entry) => [
        `${entry.repository?.originDirectory ?? "global"}/${entry.repository?.repositoryName ?? ""}:${fingerprint(entry.text)}`,
        entry,
      ]),
    ).values(),
  ];
}
