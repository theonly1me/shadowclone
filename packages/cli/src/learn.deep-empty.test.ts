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
import type { EngineRunner } from "@shadowclone/agents";
import { learn } from "./learn";
import { emptyEnvironment, learningSnapshot, writeEnvironment } from "@shadowclone/environment";

test("deep learn does not substitute structural rules for an empty result", async () => {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-deep-empty-"),
  );
  const paths = createProjectPaths({ homeDirectory, platform: "darwin" });
  const transcriptDirectory = path.join(
    paths.claudeProjectsDirectory,
    "fixture",
  );

  await mkdir(transcriptDirectory, { recursive: true });
  await writeEnvironment({
    paths,
    state: { ...emptyEnvironment, phase: "active", baselineDirectory: homeDirectory },
  });

  const records = [
    {
      type: "assistant",
      sessionId: "session",
      uuid: "event-1",
      timestamp: "2026-09-09T08:00:00.000Z",
      cwd: "/repo",
      message: {
        id: "message-1",
        content: [
          {
            type: "tool_use",
            id: "tool-1",
            name: "AskUserQuestion",
            input: { question: "Which scope?", options: ["small", "large"] },
          },
        ],
      },
    },
    {
      type: "user",
      sessionId: "session",
      uuid: "event-2",
      timestamp: "2026-09-09T08:01:00.000Z",
      cwd: "/repo",
      message: { id: "message-2", content: "Use the small scope" },
    },
  ];

  await Bun.write(
    path.join(transcriptDirectory, "session.jsonl"),
    `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
  );

  const config = setSourceEnabled({
    config: {
      ...defaultConfig,
      distillation: { deep: true },
    },
    source: "claude-code",
    enabled: true,
  });

  await writeConfig({ config, configPath: paths.configFile });

  let engineRuns = 0;
  const runner: EngineRunner = () => {
    engineRuns += 1;

    return Promise.resolve({
      engine: "claude-code",
      sessionId: "deep-session",
      transcriptPath: null,
      text: "",
      structured: { existingRules: [], newRules: [] },
      costUsd: 0.01,
      durationMs: 100,
      turns: 1,
      isError: false,
      permissionDenials: [],
      actions: [],
      errorMessage: null,
    });
  };

  await learn({
    configPath: paths.configFile,
    databasePath: paths.indexDatabase,
    paths,
    deep: true,
    runner,
    engine: "claude-code",
    managedConfigPath: null,
  });

  expect(engineRuns).toBe(1);

  expect((await learningSnapshot(paths)).rules).toHaveLength(0);
});
