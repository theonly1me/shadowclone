import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { EngineRun, EngineRunner } from "@shadowclone/agents";
import type { CorrectionSignal, IndexedEvent } from "@shadowclone/sessions";
import { distillSignals } from "./index";

const coveredInstruction = "Never use the em dash in written output.";

function newRuleRun(rejectionToken: string): EngineRun {
  return {
    engine: "claude-code", sessionId: "engine-session", transcriptPath: null, text: "",
    structured: {
      existingRules: [],
      newRules: [{
        title: "Avoid em dashes", body: "Do not use the em dash in written output.", section: "workflow",
        observed: "The user removed em dashes twice.", evidenceTokens: ["evidence-1", "evidence-2"], rejectionToken,
      }],
    },
    costUsd: 0.01, durationMs: 1, turns: 1, isError: false, permissionDenials: [], actions: [], errorMessage: null,
  };
}

async function distillWithCoverage(options: {
  readonly coverage: readonly { readonly source: string; readonly text: string }[];
}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-coverage-"));
  const sourcePath = path.join(directory, "fixture.jsonl");
  await Bun.write(sourcePath, "no em dashes please");
  const prompts: string[] = [];
  const runner: EngineRunner = (run) => {
    prompts.push(run.prompt);
    return Promise.resolve(newRuleRun("covered-1"));
  };
  const sessions = ["session-1", "session-2"];
  const signals: CorrectionSignal[] = sessions.map((sessionId, position) => ({
    kind: "interruption", category: "tool:Edit", label: "while using Edit", sessionId,
    timestamp: 1_788_537_600_000 + position, origin: { id: "github.com/acme", directoryName: "github.com--acme", promotable: true },
    repositoryName: null, textRefs: [{ type: "file", sourcePath, byteOffset: 0, byteLength: 19 }],
  }));
  const events: IndexedEvent[] = sessions.map((sessionId, position) => ({
    id: position + 1, sourcePath, source: "claude-code", sessionId, eventId: `event-${position}`, parentEventId: null,
    timestamp: 1_788_537_600_000 + position, cwd: "/repo", gitBranch: null, kind: "user-prompt", tool: null, isError: false,
    textRef: { type: "file", sourcePath, byteOffset: 0, byteLength: 19 },
  }));
  try {
    const result = await distillSignals({
      signals, runner, engine: "claude-code", workingDirectory: directory, sourceRoots: [directory],
      events, coverage: options.coverage,
    });
    return { rules: result.rules, prompt: prompts.join("\n") };
  } finally { await rm(directory, { recursive: true, force: true }); }
}

test("a new rule that restates the user's own instructions is not learned", async () => {
  const covered = await distillWithCoverage({ coverage: [{ source: "~/.codex/AGENTS.md", text: coveredInstruction }] });
  expect(covered.prompt).toContain(coveredInstruction);
  expect(covered.rules).toHaveLength(0);

  const uncovered = await distillWithCoverage({ coverage: [] });
  expect(uncovered.rules.map(({ title }) => title)).toEqual(["Avoid em dashes"]);
});
