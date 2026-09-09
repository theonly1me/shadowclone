import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { defaultManagedPolicy } from "../config";
import type { EngineRunner } from "../engine";
import type { IndexedEvent } from "../index";
import { createProjectPaths } from "../paths";
import type { CorrectionSignal, OriginScope } from "../signal";
import { runDeepLearning } from "./deepLearn";

const origin: OriginScope = {
  id: "github.com/acme",
  directoryName: "github.com--acme",
  promotable: true,
};

async function fixture() {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-deep-"));
  const paths = createProjectPaths({ homeDirectory, platform: "darwin" });
  const sourcePath = path.join(homeDirectory, "evidence.txt");
  const text = "The user asked for a smaller change.";
  await Bun.write(sourcePath, text);
  const textRef = {
    type: "file" as const,
    sourcePath,
    byteOffset: 0,
    byteLength: Buffer.byteLength(text),
  };
  const signal: CorrectionSignal = {
    kind: "question-answered",
    category: "agent-question",
    label: "an agent question",
    sessionId: "session-1",
    timestamp: 1_788_537_600_000,
    origin,
    repositoryName: null,
    textRefs: [textRef],
  };
  const event: IndexedEvent = {
    id: 1,
    sourcePath,
    source: "claude-code",
    sessionId: signal.sessionId,
    eventId: "event-1",
    parentEventId: null,
    timestamp: signal.timestamp,
    cwd: "/repo",
    gitBranch: null,
    kind: "question-answered",
    tool: null,
    isError: false,
    textRef,
  };
  return { paths, signal, event };
}

function runner(onCall: () => void): EngineRunner {
  return () => {
    onCall();
    return Promise.resolve({
      engine: "claude-code",
      sessionId: "engine-session",
      transcriptPath: null,
      text: "",
      structured: {
        existingRules: [],
        newRules: [{
          title: "Keep the change small",
          body: "Choose the smallest change that satisfies the request.",
          section: "workflow",
          observed: "The user chose the smaller scope.",
          evidenceTokens: ["evidence-1"],
          rejectionToken: "",
        }],
      },
      costUsd: 0.01,
      durationMs: 10,
      turns: 1,
      isError: false,
      permissionDenials: [],
      actions: [],
      errorMessage: null,
    });
  };
}

test("semantic dry run calls the engine and writes no local learning state", async () => {
  const { paths, signal, event } = await fixture();
  let calls = 0;
  let confirmations = 0;
  const result = await runDeepLearning({
    signals: [signal],
    events: [event],
    paths,
    policy: defaultManagedPolicy,
    runner: runner(() => { calls += 1; }),
    engine: "claude-code",
    dryRun: true,
    apply: false,
    confirm: () => { confirmations += 1; return true; },
    writeLine: () => {},
  });
  expect(calls).toBe(1);
  expect(confirmations).toBe(0);
  expect(result.profileUpdated).toBeFalse();
  expect(await Bun.file(paths.profileDirectory).exists()).toBeFalse();
  expect(await Bun.file(paths.distillDirectory).exists()).toBeFalse();
});

test("default review can decline while apply skips confirmation", async () => {
  const { paths, signal, event } = await fixture();
  let confirmations = 0;
  const common = {
    signals: [signal],
    events: [event],
    paths,
    policy: defaultManagedPolicy,
    runner: runner(() => {}),
    engine: "claude-code" as const,
    dryRun: false,
    writeLine: () => {},
  };
  const declined = await runDeepLearning({
    ...common,
    apply: false,
    confirm: () => { confirmations += 1; return false; },
  });
  expect(confirmations).toBe(1);
  expect(declined.profileUpdated).toBeFalse();
  expect(await Bun.file(path.join(paths.profileDirectory, "org")).exists()).toBeFalse();
  const applied = await runDeepLearning({
    ...common,
    apply: true,
    confirm: () => { throw new Error("Apply must skip confirmation"); },
  });
  expect(applied.profileUpdated).toBeTrue();
  expect(await Bun.file(
    path.join(paths.profileDirectory, "org", origin.directoryName, "workflow.md"),
  ).exists()).toBeTrue();
});
