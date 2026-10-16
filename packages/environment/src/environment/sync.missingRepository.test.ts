import { expect, test } from "bun:test";
import path from "node:path";
import { rm } from "node:fs/promises";
import { readConfig, writeConfig, type ProjectPaths } from "@shadowclone/core";
import { resolveRepository } from "@shadowclone/sessions";
import { skillFixture } from "./testing";
import { learningRecord } from "./fixtures";
import { skillPublication } from "./publication";
import { readEnvironment, writeEnvironment } from "./store";
import { syncLearningEnvironment } from "./sync";
import { nativePublication } from "./native";
import {
  emptyEnvironment,
  type EnvironmentRepository,
  type EnvironmentState,
  type LearningRecord,
} from "./types";

function git(options: { readonly directory: string; readonly arguments: readonly string[] }) {
  const result = Bun.spawnSync(["git", "-C", options.directory, ...options.arguments], {
    stdout: "ignore",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
}

async function publishSkill(options: {
  readonly paths: ProjectPaths;
  readonly state: EnvironmentState;
  readonly repository: EnvironmentRepository;
  readonly name: string;
}): Promise<EnvironmentState> {
  const sourceRecord = learningRecord({ key: options.name });
  const record: LearningRecord = {
    ...sourceRecord,
    rule: {
      ...sourceRecord.rule,
      scope: "project",
      originDirectory: options.repository.originDirectory,
      repositoryName: options.repository.repositoryName,
    },
  };
  const publication = await skillPublication({
    paths: options.paths,
    state: { ...options.state, records: [...options.state.records, record] },
    scope: {
      key: `${options.repository.originDirectory}/${options.repository.repositoryName}`,
      directory: options.repository.directory,
      repository: options.repository,
    },
    skill: null,
    name: options.name,
    text: `---\nname: ${options.name}\ndescription: Check ${options.name} entries\n---\n\n# Checks\n\nValidate every export.\n`,
    records: [record],
  });

  for (const update of publication.updates) {
    if (update.next !== null) await Bun.write(update.filePath, update.next);
  }

  return publication.state;
}

async function registeredCheckout() {
  const setup = await skillFixture({ scope: "repository" });
  git({ directory: setup.cwd, arguments: ["init", "-q"] });
  git({
    directory: setup.cwd,
    arguments: ["config", "remote.origin.url", "https://github.com/synthetic/palettes.git"],
  });
  const resolved = await resolveRepository({ cwd: setup.cwd, enabled: true });
  if (!resolved.profileFileName) throw new Error("Expected a synthetic repository identity");
  const repository = {
    directory: setup.cwd,
    originDirectory: resolved.origin.directoryName,
    repositoryName: resolved.profileFileName,
  };
  const config = await readConfig({ configPath: setup.paths.configFile });
  await writeConfig({
    configPath: setup.paths.configFile,
    config: {
      ...config,
      sources: { ...config.sources, "git-metadata": true, "skill-library": true },
    },
  });
  const state = await publishSkill({
    paths: setup.paths,
    state: { ...emptyEnvironment, phase: "active", repositories: [repository] },
    repository,
    name: "palette-check",
  });

  return { ...setup, repository, state };
}

async function syncReportingRemovals(paths: ProjectPaths) {
  const removed: string[] = [];
  const synchronized = await syncLearningEnvironment(paths, {
    onRemovedRepositories: (directories) => removed.push(...directories),
  });

  return { synchronized, removed };
}

test("sync removes a registered worktree that no longer exists and keeps the checkout of the same repository", async () => {
  const setup = await registeredCheckout();
  const deletedWorktree = path.join(setup.home, ".codex/worktrees/6acf/palettes");
  await writeEnvironment({
    paths: setup.paths,
    state: {
      ...setup.state,
      repositories: [{ ...setup.repository, directory: deletedWorktree }, setup.repository],
    },
  });

  expect(await syncReportingRemovals(setup.paths)).toEqual({
    synchronized: true,
    removed: [deletedWorktree],
  });
  expect((await readEnvironment(setup.paths))?.repositories).toEqual([setup.repository]);
});

test("skills published inside a deleted repository folder no longer block sync", async () => {
  const setup = await registeredCheckout();
  const charts = {
    directory: path.join(setup.home, "charts"),
    originDirectory: "github.com--synthetic--charts",
    repositoryName: "charts--synthetic",
  };
  await writeEnvironment({
    paths: setup.paths,
    state: await publishSkill({
      paths: setup.paths,
      state: { ...setup.state, repositories: [setup.repository, charts] },
      repository: charts,
      name: "chart-check",
    }),
  });
  await rm(charts.directory, { recursive: true });

  expect(await syncReportingRemovals(setup.paths)).toEqual({
    synchronized: true,
    removed: [charts.directory],
  });
  const current = await readEnvironment(setup.paths);
  expect(current?.repositories).toEqual([setup.repository]);
  expect(current?.artifacts.map((artifact) => artifact.filePath)).toEqual(
    setup.state.artifacts.map((artifact) => artifact.filePath),
  );
});

test("a maintained skill with no copy left names the skill and its files", async () => {
  const setup = await registeredCheckout();
  await writeEnvironment({ paths: setup.paths, state: setup.state });
  const copies = setup.state.artifacts
    .filter((artifact) => artifact.kind === "skill")
    .map((artifact) => artifact.filePath);
  await Promise.all(copies.map((copy) => rm(copy)));

  await expect(syncLearningEnvironment(setup.paths)).rejects.toThrow(
    `Every copy of the maintained skill palette-check is missing: ${copies.join(", ")}. Restore one copy, then run shadowclone sync again.`,
  );
});

test("a registered checkout whose origin changed names its folder", async () => {
  const setup = await registeredCheckout();
  await writeEnvironment({ paths: setup.paths, state: setup.state });
  git({
    directory: setup.cwd,
    arguments: ["config", "remote.origin.url", "https://github.com/synthetic/other.git"],
  });

  await expect(syncLearningEnvironment(setup.paths)).rejects.toThrow(
    `The registered repository at ${setup.cwd} changed its Git origin or is blocked. shadowclone kept the native files.`,
  );
});

test("learning that reaches a deleted repository folder says to run sync", async () => {
  const setup = await registeredCheckout();
  const deletedWorktree = path.join(setup.home, ".codex/worktrees/6acf/palettes");

  await expect(
    nativePublication({
      paths: setup.paths,
      state: {
        ...setup.state,
        repositories: [{ ...setup.repository, directory: deletedWorktree }],
      },
    }),
  ).rejects.toThrow(
    `The registered repository folder ${deletedWorktree} no longer exists. Run shadowclone sync to remove it.`,
  );
});
