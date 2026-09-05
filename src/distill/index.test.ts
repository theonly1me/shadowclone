import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  EngineRun,
  EngineRunner,
} from "../engine";
import type { IndexedEvent } from "../index";
import type {
  CorrectionSignal,
  OriginScope,
} from "../signal";
import {
  buildDistillPrompt,
  distillSignals,
} from "./index";

const plantedSecret = "sk-proj-distillSecret123456789";

function origin(id: string): OriginScope {
  return {
    id,
    directoryName: id.replace("/", "--"),
    promotable: true,
  };
}

function signal(options: {
  readonly sourcePath: string;
  readonly origin: OriginScope;
}): CorrectionSignal {
  return {
    kind: "interruption",
    category: "tool:Edit",
    label: "while using Edit",
    sessionId: "session-1",
    timestamp: 1_788_537_600_000,
    origin: options.origin,
    textRefs: [
      {
        sourcePath: options.sourcePath,
        byteOffset: 0,
        byteLength: Buffer.byteLength(plantedSecret),
      },
    ],
  };
}

function successfulRun(): EngineRun {
  return {
    engine: "claude-code",
    sessionId: "engine-session",
    transcriptPath: null,
    text: "",
    structured: {
      rules: [
        {
          title: "Review edits before continuing",
          body: "Pause after an edit and verify its direction.",
          section: "workflow",
        },
      ],
    },
    costUsd: 0.01,
    durationMs: 100,
    turns: 1,
    isError: false,
    permissionDenials: [],
  };
}

function indexedPrompt(sourcePath: string): IndexedEvent {
  return {
    id: 1,
    sourcePath,
    source: "claude-code",
    sessionId: "session-1",
    eventId: "event-1",
    parentEventId: null,
    timestamp: 1_788_537_600_000,
    cwd: "/repo",
    gitBranch: null,
    kind: "user-prompt",
    tool: null,
    isError: false,
    textRef: {
      sourcePath,
      byteOffset: 0,
      byteLength: Buffer.byteLength(plantedSecret),
    },
  };
}

test("refuses mixed-origin input before resolving any pointer", async () => {
  const first = signal({
    sourcePath: "/must/not/be/read-one",
    origin: origin("github.com/one"),
  });
  const second = signal({
    sourcePath: "/must/not/be/read-two",
    origin: origin("github.com/two"),
  });

  await expect(
    buildDistillPrompt({ signals: [first, second] }),
  ).rejects.toThrow("one origin");
});

test("redacts excerpts before the engine and resumes from checkpoints", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-distill-"),
  );
  const sourcePath = path.join(directory, "fixture.jsonl");
  await Bun.write(sourcePath, plantedSecret);
  const signals = [signal({ sourcePath, origin: origin("github.com/acme") })];
  const prompts: string[] = [];
  const runner: EngineRunner = (options) => {
    prompts.push(options.prompt);
    return Promise.resolve(successfulRun());
  };
  const options = {
    signals,
    runner,
    workingDirectory: directory,
    checkpointDirectory: path.join(directory, "checkpoints"),
    events: [indexedPrompt(sourcePath)],
  };

  const first = await distillSignals(options);
  const second = await distillSignals(options);

  expect(prompts).toHaveLength(1);
  expect(prompts[0]).not.toContain(plantedSecret);
  expect(prompts[0]).toContain("[redacted:llm-api-key]");
  expect(first.engineRuns).toBe(1);
  expect(second.engineRuns).toBe(0);
  expect(second.rules).toEqual(first.rules);
});
