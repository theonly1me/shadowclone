import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { EngineRunner } from "../engine";
import { runReplay } from "./index";

test("replays only a redacted first prompt through the engine", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-replay-"),
  );
  const plantedSecret = "sk-proj-replaySecret123456789";
  const sourcePath = path.join(directory, "session.jsonl");
  await Bun.write(sourcePath, plantedSecret);
  let receivedPrompt = "";
  const runner: EngineRunner = (options) => {
    receivedPrompt = options.prompt;
    return Promise.resolve({
      engine: "claude-code",
      sessionId: "replay",
      transcriptPath: null,
      text: "",
      structured: null,
      costUsd: 0,
      durationMs: 1,
      turns: 1,
      isError: false,
      permissionDenials: [],
      actions: [],
      errorMessage: null,
    });
  };
  const actual = {
    tools: ["Read"],
    verificationSteps: ["test"],
    filesTouched: ["src/main.ts"],
    plannedBeforeEditing: true,
  };

  const score = await runReplay({
    promptRef: {
      type: "file",
      sourcePath,
      byteOffset: 0,
      byteLength: Buffer.byteLength(plantedSecret),
    },
    actual,
    runner,
    behaviorFromRun: () => Promise.resolve(actual),
    cwd: directory,
    systemPromptFile: path.join(directory, "profile.md"),
    allowedTools: ["Read"],
  });

  expect(receivedPrompt).not.toContain(plantedSecret);
  expect(receivedPrompt).toContain("[redacted:llm-api-key]");
  expect(score.total).toBe(1);
});
