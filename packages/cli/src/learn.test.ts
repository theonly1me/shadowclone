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
import { openEventIndex } from "@shadowclone/sessions";
import { learn } from "./learn";
import { emptyEnvironment, learningSnapshot, writeEnvironment } from "@shadowclone/environment";

test("learn indexes an enabled fixture corpus end to end", async () => {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-learn-"),
  );
  const paths = createProjectPaths({
    homeDirectory,
    platform: "darwin",
  });
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
      type: "user",
      sessionId: "session-1",
      uuid: "event-1",
      timestamp: "2026-09-05T08:00:00.000Z",
      cwd: "/repo",
      message: { id: "message-1", content: "plan this change" },
    },
    {
      type: "assistant",
      sessionId: "session-1",
      uuid: "event-2",
      timestamp: "2026-09-05T08:01:00.000Z",
      cwd: "/repo",
      message: {
        id: "message-2",
        content: [{ type: "tool_use", id: "tool-1", name: "Edit" }],
      },
    },
    {
      type: "user",
      sessionId: "session-1",
      uuid: "event-3",
      timestamp: "2026-09-05T08:02:00.000Z",
      cwd: "/repo",
      message: {
        id: "message-3",
        content: "[Request interrupted by user]",
      },
    },
    {
      type: "assistant",
      sessionId: "session-1",
      uuid: "event-4",
      timestamp: "2026-09-05T08:03:00.000Z",
      cwd: "/repo",
      message: {
        id: "message-4",
        content: [
          {
            type: "tool_use",
            id: "tool-2",
            name: "AskUserQuestion",
            input: { question: "Which scope?", options: ["small", "large"] },
          },
        ],
      },
    },
    {
      type: "user",
      sessionId: "session-1",
      uuid: "event-5",
      timestamp: "2026-09-05T08:04:00.000Z",
      cwd: "/repo",
      message: { id: "message-5", content: "Use the small scope" },
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

  await learn({
    configPath: paths.configFile,
    databasePath: paths.indexDatabase,
    paths,
    managedConfigPath: null,
  });

  const index = await openEventIndex(paths.indexDatabase);

  expect(index.countEvents()).toBe(5);

  index.close();

  let engineRuns = 0;
  const runner: EngineRunner = () => {
    engineRuns += 1;

    return Promise.resolve({
      engine: "claude-code",
      sessionId: "deep-session",
      transcriptPath: null,
      text: "",
      structured: {
        assessments: [
          {
            evidenceToken: ["evidence", "1"].join("-"),
            intent: "preference",
            durable: true,
            scope: "repository",
          },
        ],
        existingRules: [],
        newRules: [
          {
            title: "Choose the smaller scope",
            body: "Prefer the smaller change when the user is asked.",
            section: "workflow",
            observed: "The user chose the smaller scope.",
            evidenceTokens: ["evidence-1"],
            rejectionToken: "",
          },
        ],
      },
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
    apply: true,
    managedConfigPath: null,
  });

  expect(engineRuns).toBe(1);

  const profile = (await learningSnapshot(paths)).rules
    .map(({ rule }) => `${rule.title}\n${rule.body}`)
    .join("\n");

  if (profile.length === 0) {
    throw new Error("Expected learn to store a rule");
  }

  expect(profile).not.toContain("Stops the agent while using Edit");
  expect(profile).toContain("Choose the smaller scope");
  expect(profile).not.toContain("plan this change");
});
