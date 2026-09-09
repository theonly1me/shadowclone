import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { defaultConfig, writeConfig } from "../config";
import type { EngineRunner } from "../engine";
import { createProjectPaths } from "../paths";
import { writeProfile } from "../profile";
import type { ProfileRule } from "../profile";
import { resolveCwdOrigin } from "../signal";
import type { CommandRunner } from "./index";
import { runHeadlessClone } from "./index";

const nestedSkillBody = [
  "### Process",
  "",
  "Run the focused tests, then the repository gate. Structure a report like this:",
  "",
  "```markdown",
  "## What changed",
  "",
  "## How to verify",
  "```",
].join("\n");

const commandRunner: CommandRunner = (options) => {
  const command = options.command.join(" ");
  if (command === "git rev-parse --show-toplevel") {
    return Promise.resolve({ exitCode: 0, stdout: `${options.cwd}\n` });
  }
  if (command === "git rev-parse HEAD") {
    return Promise.resolve({ exitCode: 0, stdout: "base-commit\n" });
  }
  return Promise.resolve({ exitCode: 0, stdout: "" });
};

const runner: EngineRunner = () =>
  Promise.resolve({
    engine: "claude-code",
    sessionId: "run-abcdef12",
    transcriptPath: null,
    text: "",
    structured: null,
    costUsd: 0.1,
    durationMs: 100,
    turns: 1,
    isError: false,
    permissionDenials: [],
    actions: [],
    errorMessage: null,
  });

test("the receipt counts applied rules, not nested skill headings", async () => {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-dispatch-rules-"),
  );
  const repoDirectory = path.join(homeDirectory, "repo");
  const paths = createProjectPaths({ homeDirectory, platform: "darwin" });
  await writeConfig({ config: defaultConfig, configPath: paths.configFile });
  const origin = await resolveCwdOrigin({ cwd: repoDirectory, enabled: false });
  const rule: ProfileRule = {
    key: "verify-before-presenting",
    title: "Verify before presenting",
    body: nestedSkillBody,
    section: "workflow",
    scope: "org",
    originDirectory: origin.directoryName,
    repositoryName: null,
    source: "declared",
    status: "active",
    proposal: null,
    appliesWhen: [],
    evidence: { for: [], against: [] },
    observations: 0,
    lastSeen: "declared",
    sessions: 0,
    origins: [origin.id],
    importReference: null,
  };
  await writeProfile({ paths, rules: [rule] });

  const receipt = await runHeadlessClone({
    task: "Add the focused test",
    targetDirectory: repoDirectory,
    configPath: paths.configFile,
    managedConfigPath: null,
    paths,
    runner,
    commandRunner,
    runId: "run-abcdef12",
    startedAt: "2026-09-09T08:00:00.000Z",
  });

  const profile = await Bun.file(
    path.join(paths.runDirectory("run-abcdef12"), "profile.md"),
  ).text();

  expect(profile).toContain("## How to verify");
  expect(profile.match(/^## /gm)).toHaveLength(3);
  expect(receipt.profileRulesApplied).toBe(1);
});
