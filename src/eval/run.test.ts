import { expect, test } from "bun:test";
import { mkdir, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { defaultConfig, writeConfig } from "../config";
import type { EngineRun, EngineRunner } from "../engine";
import { openEventIndex } from "../index";
import type { FileTextRef } from "../observe";
import { createProjectPaths } from "../paths";
import { runEval } from "./run";

test("runEval executes baseline and clone runs and writes an eval receipt", async () => {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-eval-test-"),
  );
  const paths = createProjectPaths({
    homeDirectory,
    platform: "darwin",
  });
  await mkdir(paths.profileDirectory, { recursive: true });
  await writeConfig({ config: defaultConfig, configPath: paths.configFile });

  const index = await openEventIndex(paths.indexDatabase);
  const secretText = "reproduce this bug";
  const ref: FileTextRef = {
    type: "file",
    sourcePath: path.join(homeDirectory, "prompt.txt"),
    byteOffset: 0,
    byteLength: secretText.length,
  };
  await Bun.write(ref.sourcePath, secretText);

  index.saveBatch({
    source: "claude-code",
    sourcePath: ref.sourcePath,
    events: [
      {
        source: "claude-code",
        sessionId: "session-1",
        eventId: "e1",
        parentEventId: null,
        timestamp: Date.now(),
        cwd: "/repo",
        gitBranch: "main",
        kind: "user-prompt",
        tool: null,
        isError: false,
        textRef: ref,
      },
      {
        source: "claude-code",
        sessionId: "session-1",
        eventId: "e2",
        parentEventId: "e1",
        timestamp: Date.now() + 100,
        cwd: "/repo",
        gitBranch: "main",
        kind: "tool-call",
        tool: { name: "Edit", toolUseId: "t1" },
        isError: false,
        textRef: null,
      },
    ],
    cursor: {
      sourcePath: ref.sourcePath,
      byteOffset: secretText.length,
      byteSize: secretText.length,
      modifiedAt: Date.now(),
    },
    rescanned: false,
    bytesRead: secretText.length,
  });
  index.close();

  const runs: { systemPromptFile?: string; permissionMode?: string }[] = [];
  const runner: EngineRunner = (options) => {
    runs.push({
      systemPromptFile: options.systemPromptFile,
      permissionMode: options.permissionMode,
    });
    const run: EngineRun = {
      engine: "claude-code",
      sessionId: options.sessionId ?? "mock",
      transcriptPath: null,
      text: "done",
      structured: null,
      costUsd: 0.05,
      durationMs: 50,
      turns: 1,
      isError: false,
      permissionDenials: [],
      actions: options.systemPromptFile
        ? [{ tool: "Edit", path: "src/index.ts", command: null }]
        : [{ tool: "Read", path: "README.md", command: null }],
    };
    return Promise.resolve(run);
  };

  const receipt = await runEval({
    paths,
    configPath: paths.configFile,
    runner,
  });

  expect(runs.length).toBe(2);
  expect(runs[0]?.systemPromptFile).toBeUndefined();
  expect(runs[0]?.permissionMode).toBe("dontAsk");
  expect(runs[1]?.systemPromptFile).toBeDefined();
  expect(runs[1]?.permissionMode).toBe("dontAsk");

  expect(receipt.sessionsEvaluated).toBe(1);
  expect(receipt.averageDelta.total).toBeGreaterThan(0);

  const receiptFile = path.join(
    paths.shadowcloneDirectory,
    "eval",
    `${receipt.evalId}.json`,
  );
  expect(await Bun.file(receiptFile).exists()).toBeTrue();
});
