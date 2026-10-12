import { expect, test } from "bun:test";
import { mkdir, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  defaultConfig,
  setSourceEnabled,
  writeConfig,
  createProjectPaths,
} from "@shadowclone/core";
import { openEventIndex } from "@shadowclone/sessions";
import type { ProfileRule } from "@shadowclone/profile";
import { learn } from "./learn";
import { emptyEnvironment, environmentFile, storeLearningRules, writeEnvironment } from "@shadowclone/environment";

function declaredRule(): ProfileRule {
  return {
    key: "declared-plan-first",
    title: "Plans consequential changes",
    body: "Write a plan before changing architecture.",
    section: "workflow",
    scope: "global",
    originDirectory: null,
    repositoryName: null,
    source: "declared",
    status: "active",
    proposal: null,
    appliesWhen: [],
    evidence: { for: [], against: [] },
    observations: 0,
    lastSeen: "unknown",
    sessions: 0,
    origins: [],
    importReference: null,
  };
}

test("plain learn reports evidence without changing the profile", async () => {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-learn-report-"),
  );
  const paths = createProjectPaths({ homeDirectory, platform: "darwin" });
  const transcriptDirectory = path.join(
    paths.claudeProjectsDirectory,
    "fixture",
  );

  await mkdir(transcriptDirectory, { recursive: true });

  const records = [
    {
      type: "assistant",
      sessionId: "session",
      uuid: "event-1",
      timestamp: "2026-09-09T08:00:00.000Z",
      cwd: "/repo",
      message: {
        id: "message-1",
        content: [{ type: "tool_use", id: "tool-1", name: "Edit" }],
      },
    },
    {
      type: "user",
      sessionId: "session",
      uuid: "event-2",
      timestamp: "2026-09-09T08:01:00.000Z",
      cwd: "/repo",
      message: { id: "message-2", content: "[Request interrupted by user]" },
    },
  ];

  await Bun.write(
    path.join(transcriptDirectory, "session.jsonl"),
    `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
  );

  const config = setSourceEnabled({
    config: defaultConfig,
    source: "claude-code",
    enabled: true,
  });

  await writeConfig({ config, configPath: paths.configFile });
  await writeEnvironment({
    paths,
    state: { ...emptyEnvironment, phase: "active", baselineDirectory: paths.shadowcloneDirectory },
  });
  await storeLearningRules({ paths, rules: [declaredRule()] });

  const before = await Bun.file(environmentFile(paths)).text();

  await learn({
    configPath: paths.configFile,
    databasePath: paths.indexDatabase,
    paths,
    managedConfigPath: null,
  });

  expect(await Bun.file(environmentFile(paths)).text()).toBe(before);

  const index = await openEventIndex(paths.indexDatabase);

  expect(index.countEvents()).toBe(2);

  index.close();
});
