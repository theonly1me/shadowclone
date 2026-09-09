import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { EngineRun } from "../../engine";
import type { IndexedEvent } from "../../index";
import { learnEvaluationProfile } from "./profile";
import type { Evidence } from "./types";

function sessionEvents(options: {
  readonly session: string;
  readonly base: number;
  readonly sourcePath: string;
  readonly byteLength: number;
}): readonly IndexedEvent[] {
  const shared = {
    sourcePath: options.sourcePath,
    source: "claude-code" as const,
    sessionId: options.session,
    parentEventId: null,
    cwd: "/repo",
    gitBranch: null,
    tool: null,
    isError: false,
  };
  return [
    {
      ...shared,
      id: options.base,
      eventId: `call-${options.session}`,
      timestamp: options.base,
      kind: "tool-call",
      tool: { toolUseId: `tool-${options.session}`, name: "Edit" },
      textRef: null,
    },
    {
      ...shared,
      id: options.base + 1,
      eventId: `stop-${options.session}`,
      timestamp: options.base + 1,
      kind: "interruption",
      textRef: {
        type: "file",
        sourcePath: options.sourcePath,
        byteOffset: 0,
        byteLength: options.byteLength,
      },
    },
  ];
}

function distilledRun(): EngineRun {
  return {
    engine: "claude-code",
    sessionId: "engine-session",
    transcriptPath: null,
    text: "",
    structured: {
      existingRules: [],
      newRules: [
        {
          title: "Review edits before continuing",
          body: "Pause after an edit and verify its direction.",
          section: "workflow",
          observed: "The user repeatedly interrupted edits.",
          evidenceTokens: ["evidence-1", "evidence-2", "evidence-3"],
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
  };
}

test("evaluation renders distilled rules through the production compiler", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-transfer-profile-"),
  );
  const sourcePath = path.join(directory, "fixture.jsonl");
  const excerpt = "stop editing now";
  await Bun.write(sourcePath, excerpt);
  const byteLength = Buffer.byteLength(excerpt);
  const sessions = ["session-1", "session-2", "session-3"];
  const events = sessions.flatMap((session, index) =>
    sessionEvents({
      session,
      base: (index + 1) * 10,
      sourcePath,
      byteLength,
    }),
  );
  const training: readonly Evidence[] = sessions.map((session, index) => ({
    id: `training-${index}`,
    sessionId: `claude-code:${session}`,
    timestamp: (index + 1) * 10,
    text: excerpt,
  }));

  const profile = await learnEvaluationProfile({
    events,
    training,
    cutoff: 1_000,
    call: () => Promise.resolve(distilledRun()),
    engine: "claude-code",
    directory,
  });

  expect(profile).toContain("## Review edits before continuing");
  expect(profile).toContain("Guidance source: observed in the user's sessions");
});
