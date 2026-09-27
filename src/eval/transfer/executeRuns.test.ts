import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { repositoryGuidance } from "./execute";
import { executeTransferRuns } from "./executeRuns";
import { readReceipt } from "./resume";
import { batchReply } from "./judgeFixtures";
import { disposeSnapshotTemplates } from "./snapshot";
import { initialReceipt } from "./storage";
import { fingerprint } from "./structured";
import type { EvaluationProgress, PreparedEval } from "./types";
import { fixture } from "./executeRuns.fixtures";

test("safe mode explicitly loads the selected agent's repository guidance", () => {
  expect(repositoryGuidance("claude-code")).toContain("CLAUDE.md");
  expect(repositoryGuidance("claude-code")).toContain(".claude/skills");
  expect(repositoryGuidance("codex")).toContain("AGENTS.md");
  expect(repositoryGuidance("codex")).toContain(".agents/skills");
});

test("shows every stage and gives personal context only to the skills and clone arms", async () => {
  const repository = await fixture();
  const outputDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-paired-output-"),
  );
  const controlDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-paired-control-"),
  );
  const profile = "Use complete names.";

  const prepared: PreparedEval = {
    schemaVersion: 12,
    evalId: "00000000-0000-4000-8000-000000000001",
    suiteId: "00000000-0000-4000-8000-000000000002",
    repository: repository.directory,
    baseCommit: repository.commit,
    context: [
      {
        relativePath: "skills/0/clean-code/SKILL.md",
        content: "Use complete names.",
      },
    ],
    profileSnapshot: {
      kind: "current",
      fingerprint: fingerprint(profile),
      ruleCount: 1,
    },
    tasks: [
      {
        id: "task",
        startingCommit: repository.commit,
        prompt: "Create a new parser utility and focused tests.",
        completion: ["The parser works"],
        preferences: [
          {
            requirement: "Use complete names",
            source: {
              relativePath: "profile.md",
              heading: "",
              line: 1,
            },
          },
        ],
        profile,
        profileFingerprint: fingerprint(profile),
      },
    ],
    engine: "codex",
    model: "gpt-5.6-luna",
    reasoningEffort: "medium",
    dependencyMode: "current",
    repeat: 1,
    timeoutSeconds: 60,
    maxBudgetUsd: null,
    dirtyFileCount: 0,
    preflight: [
      { requirement: "Snapshot", verdict: "pass", evidence: "ok", votes: [] },
    ],
  };

  const progress: EvaluationProgress[] = [];
  const contextPresence: boolean[] = [];
  const codingPrompts: string[] = [];
  let releaseFirstCodingCall: (() => void) | undefined;
  let firstCodingCallTimedOut = false;

  try {
    const receipt = await executeTransferRuns({
      receipt: initialReceipt(prepared),
      directory: outputDirectory,
      controlDirectory,
      json: true,
      startedAt: Date.now(),
      onProgress: (event) => {
        progress.push(event);
      },
      call: async (options) => {
        if (options.access === "write") {
          codingPrompts.push(options.prompt);
          contextPresence.push(
            await Bun.file(
              path.join(
                options.cwd,
                ".eval-context/skills/0/clean-code/SKILL.md",
              ),
            ).exists(),
          );

          if (contextPresence.length === 1) {
            await new Promise<void>((resolve) => {
              const timeout = setTimeout(() => {
                firstCodingCallTimedOut = true;
                resolve();
              }, 1_000);

              releaseFirstCodingCall = () => {
                clearTimeout(timeout);
                resolve();
              };
            });
          } else {
            releaseFirstCodingCall?.();
          }

          await Bun.write(
            path.join(options.cwd, "newParser.ts"),
            "export const parseValue = (value: string) => value.trim();\n",
          );

          return {
            engine: "codex",
            sessionId: "coding",
            transcriptPath: null,
            text: "done",
            structured: null,
            costUsd: null,
            durationMs: 1,
            turns: 1,
            actions: [],
            permissionDenials: [],
            isError: false,
            errorMessage: null,
          };
        }

        return batchReply(options);
      },
    });

    expect(contextPresence.toSorted()).toEqual([false, true, true]);
    expect(codingPrompts).toHaveLength(3);
    expect(
      codingPrompts.every(
        (prompt) =>
          prompt.includes("AGENTS.md") && prompt.includes(".agents/skills"),
      ),
    ).toBeTrue();
    expect(firstCodingCallTimedOut).toBeFalse();

    const savedReceipt = readReceipt(
      await Bun.file(path.join(outputDirectory, "state.json")).text(),
    );

    expect(savedReceipt.runs).toHaveLength(3);
    expect(receipt.runs.every((run) => run.phase === "complete")).toBeTrue();

    const stages = progress.map((event) => event.stage);

    for (const stage of [
      "snapshot",
      "coding",
      "collecting",
      "safety",
      "judging",
      "complete",
    ] as const) {
      expect(stages).toContain(stage);
    }

    expect(progress.filter((event) => event.stage === "judging")).toHaveLength(
      9,
    );
  } finally {
    await disposeSnapshotTemplates();
    await rm(repository.directory, { recursive: true, force: true });
    await rm(outputDirectory, { recursive: true, force: true });
    await rm(controlDirectory, { recursive: true, force: true });
  }
});
