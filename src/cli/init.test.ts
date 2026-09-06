import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readConfig } from "../config";
import { initialize } from "./init";

test("enables Claude Code only after consent", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-init-"));
  const configPath = path.join(directory, "config.toml");
  const answers = [false, true, false, false, false, false, false, false, false];

  await initialize({
    configPath,
    ask: () => answers.shift() ?? false,
  });

  const config = await readConfig({ configPath });
  expect(config.sources.antigravity).toBeFalse();
  expect(config.sources["claude-code"]).toBeTrue();
  expect(config.sources["claude-prompts"]).toBeFalse();
  expect(config.sources.codex).toBeFalse();
  expect(config.sources.cursor).toBeFalse();
  expect(config.sources["git-metadata"]).toBeFalse();
  expect(config.sources["agent-context"]).toBeFalse();
  expect(config.sources.shell).toBeFalse();
  expect(config.distillation.deep).toBeFalse();
});

test("enables git metadata only after separate consent", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-init-"));
  const configPath = path.join(directory, "config.toml");
  const answers = [false, false, false, false, false, false, true, false, false];

  await initialize({
    configPath,
    ask: () => answers.shift() ?? false,
  });

  const config = await readConfig({ configPath });
  expect(config.sources["claude-code"]).toBeFalse();
  expect(config.sources["git-metadata"]).toBeTrue();
  expect(config.sources["agent-context"]).toBeFalse();
});

test("enables agent context only after separate consent", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-init-"));
  const configPath = path.join(directory, "config.toml");
  const answers = [false, false, false, false, false, false, false, true, false];

  await initialize({
    configPath,
    ask: () => answers.shift() ?? false,
  });

  const config = await readConfig({ configPath });
  expect(config.sources["agent-context"]).toBeTrue();
  expect(config.sources["git-metadata"]).toBeFalse();
});

test("enables deep distillation only after separate consent", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-init-"));
  const configPath = path.join(directory, "config.toml");
  const answers = [false, false, false, false, false, false, false, false, true];

  await initialize({
    configPath,
    ask: () => answers.shift() ?? false,
  });

  const config = await readConfig({ configPath });
  expect(config.distillation.deep).toBeTrue();
  expect(Object.values(config.sources).every((enabled) => !enabled)).toBeTrue();
});

test("enables provider transcripts only after named consent", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-init-"));
  const configPath = path.join(directory, "config.toml");
  const questions: string[] = [];
  const answers = [true, false, false, true, true, false, false, false, false];

  await initialize({
    configPath,
    ask: (question) => {
      questions.push(question);
      return answers.shift() ?? false;
    },
  });

  const config = await readConfig({ configPath });
  expect(config.sources.antigravity).toBeTrue();
  expect(config.sources.codex).toBeTrue();
  expect(config.sources.cursor).toBeTrue();
  expect(questions).toContain("Enable Antigravity CLI transcripts?");
  expect(questions).toContain("Enable Codex transcripts?");
  expect(questions).toContain("Enable Cursor CLI chat stores?");
});

test("keeps every source off when consent is declined", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-init-"));
  const configPath = path.join(directory, "config.toml");

  await initialize({
    configPath,
    ask: () => false,
  });

  const config = await readConfig({ configPath });
  expect(Object.values(config.sources).every((enabled) => !enabled)).toBeTrue();
});
