import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readConfig } from "../config";
import { createProjectPaths } from "../paths";
import { readGeneratedProfileState } from "../profile";
import { readMaintenanceState } from "../skillMaintenance";
import { fixtureSkill } from "../skillMaintenance/fixtures";
import { answerIsYes, initialize } from "./init";

test("default yes prompt treats an explicit no as declined consent", () => {
  expect(answerIsYes("")).toBeTrue();
  expect(answerIsYes("Y")).toBeTrue();
  expect(answerIsYes("yes")).toBeTrue();
  expect(answerIsYes("n")).toBeFalse();
  expect(answerIsYes("no")).toBeFalse();
  expect(answerIsYes(null)).toBeFalse();
});

test("default setup asks three questions and enables only detected session sources", async () => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-init-default-"));
  const paths = createProjectPaths({ homeDirectory, platform: "darwin" });
  const questions: string[] = [];
  const output: string[] = [];
  const installs: string[] = [];
  await initialize({
    paths,
    workingDirectory: homeDirectory,
    presence: {
      hasRepositoryGuidance: false,
      presentCaptureSources: new Set(["claude-code", "codex"]),
    },
    agents: ["claude-code", "codex"],
    ask: (question) => {
      questions.push(question);
      return questions.length === 1;
    },
    install: async (options) => { installs.push(...options.agents); },
    writeLine: (line) => output.push(line),
  });

  const config = await readConfig({ configPath: paths.configFile });
  expect(questions).toHaveLength(3);
  expect(questions.every((question) => !/eval|baseline/i.test(question))).toBeTrue();
  expect(config.sources["claude-code"]).toBeTrue();
  expect(config.sources.codex).toBeTrue();
  expect(config.sources.cursor).toBeFalse();
  expect(config.sources.shell).toBeFalse();
  expect(config.sources["git-metadata"]).toBeTrue();
  expect(config.sources["agent-context"]).toBeTrue();
  expect(config.sources["skill-library"]).toBeFalse();
  expect(config.distillation.deep).toBeFalse();
  expect(config.distillation.automatic).toBeFalse();
  expect(installs).toEqual(["claude-code", "codex"]);
  expect(output.join("\n")).toContain("~/.claude/projects");
  expect(output.join("\n")).toContain("~/.codex/sessions");
  expect(output.join("\n")).not.toContain("~/.cursor/chats");
});

test("declining background learning makes no model call", async () => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-init-default-"));
  const paths = createProjectPaths({ homeDirectory, platform: "darwin" });
  let calls = 0;
  await initialize({
    paths,
    workingDirectory: homeDirectory,
    presence: { hasRepositoryGuidance: false, presentCaptureSources: new Set() },
    agents: [],
    ask: () => false,
    runner: () => {
      calls += 1;
      throw new Error("The model must not run");
    },
    engine: "codex",
    writeLine: () => {},
  });
  const config = await readConfig({ configPath: paths.configFile });
  expect(calls).toBe(0);
  expect(config.distillation.deep).toBeFalse();
  expect(config.distillation.automatic).toBeFalse();
});

test("skill consent works without enabling transcript capture or model calls", async () => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-init-default-"));
  const paths = createProjectPaths({ homeDirectory, platform: "darwin" });
  await Bun.write(path.join(homeDirectory, ".claude/skills/typed-changes/SKILL.md"), fixtureSkill());
  let modelCalls = 0;
  await initialize({
    paths,
    workingDirectory: homeDirectory,
    presence: { hasRepositoryGuidance: false, presentCaptureSources: new Set() },
    agents: [],
    ask: (question) => question.startsWith("Keep your skills"),
    runner: () => {
      modelCalls += 1;
      throw new Error("The model must not run");
    },
    engine: "codex",
    managedConfigPath: null,
    writeLine: () => {},
  });
  const config = await readConfig({ configPath: paths.configFile });
  expect(config.sources["skill-library"]).toBeTrue();
  expect(config.sources["claude-code"]).toBeFalse();
  expect(config.distillation.deep).toBeFalse();
  expect(config.distillation.automatic).toBeFalse();
  expect((await readMaintenanceState(paths)).roots.length).toBeGreaterThan(0);
  expect(await Bun.file(path.join(homeDirectory, ".codex/skills/typed-changes/SKILL.md")).text()).toBe(fixtureSkill());
  expect(modelCalls).toBe(0);
});

test("default setup imports guidance and writes a profile with an injected clock and runner", async () => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-init-default-"));
  const paths = createProjectPaths({ homeDirectory, platform: "darwin" });
  await Bun.write(path.join(homeDirectory, "CLAUDE.md"), "# Plan the smallest change\n");
  await initialize({
    paths,
    workingDirectory: homeDirectory,
    presence: { hasRepositoryGuidance: true, presentCaptureSources: new Set() },
    agents: [],
    ask: (question) => !question.startsWith("Keep your skills"),
    runner: () => { throw new Error("No sessions were detected"); },
    engine: "codex",
    now: 1_800_000_000_000,
    managedConfigPath: null,
    writeLine: () => {},
  });
  expect(await readGeneratedProfileState(paths.profileManifestFile)).toHaveLength(1);
});
