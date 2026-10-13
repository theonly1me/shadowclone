import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createProjectPaths, readConfig } from "@shadowclone/core";
import { initialize } from "./init";

test("advanced setup enables OpenCode capture only after the named OpenCode question", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-init-"));
  const configPath = path.join(directory, "config.toml");
  const questions: string[] = [];

  await initialize({
    configPath,
    paths: createProjectPaths({ homeDirectory: directory, platform: "darwin" }),
    advanced: true,
    ask: (question) => {
      questions.push(question);

      return question === "Enable OpenCode transcripts?";
    },
    writeLine: () => {},
    presence: { hasRepositoryGuidance: true, presentCaptureSources: new Set(["opencode"]) },
  });

  const config = await readConfig({ configPath });
  const enabled = Object.entries(config.sources).flatMap(([source, on]) => (on ? [source] : []));

  expect(questions).toContain("Enable OpenCode transcripts?");
  expect(enabled).toEqual(["opencode"]);
});
