import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readConfig } from "../config";
import { initialize } from "./init";

test("enables Claude Code only after consent", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-init-"));
  const configPath = path.join(directory, "config.toml");

  await initialize({
    configPath,
    ask: () => true,
  });

  const config = await readConfig({ configPath });
  expect(config.sources["claude-code"]).toBeTrue();
  expect(config.sources["claude-prompts"]).toBeFalse();
  expect(config.sources.codex).toBeFalse();
  expect(config.sources.cursor).toBeFalse();
  expect(config.sources.shell).toBeFalse();
  expect(config.distillation.deep).toBeFalse();
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
