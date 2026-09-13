import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { command } from "./command";
import { executeTransferRuns } from "./executeRuns";
import { readReceipt } from "./resume";
import { disposeSnapshotTemplates } from "./snapshot";
import { initialReceipt } from "./storage";
import { fingerprint } from "./structured";
import type { EvaluationProgress, PreparedEval } from "./types";

async function fixture(): Promise<{
  readonly directory: string;
  readonly commit: string;
}> {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-paired-eval-"),
  );
  await Bun.write(
    path.join(directory, "package.json"),
    JSON.stringify({ scripts: { test: "exit 23" } }),
  );
  await command({ arguments: ["git", "init", "--quiet"], cwd: directory });
  await command({ arguments: ["git", "add", "--all"], cwd: directory });
  await command({
    arguments: [
      "git",
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@localhost",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--quiet",
      "-m",
      "fixture",
    ],
    cwd: directory,
  });
  return {
    directory,
    commit: await command({
      arguments: ["git", "rev-parse", "HEAD"],
      cwd: directory,
    }),
  };
}

function candidate() {
  return {
    correctness: [{ verdict: "pass", evidence: "Code meets behavior" }],
    preferences: [{ verdict: "pass", evidence: "Code follows guidance" }],
  } as const;
}

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
    schemaVersion: 11,
    evalId: "00000000-0000-4000-8000-000000000001",
    suiteId: "00000000-0000-4000-8000-000000000002",
    repository: repository.directory,
    baseCommit: repository.commit,
    context: [{
      relativePath: "skills/0/clean-code/SKILL.md",
      content: "Use complete names.",
    }],
    profileSnapshot: {
      kind: "current",
      fingerprint: fingerprint(profile),
      ruleCount: 1,
    },
    tasks: [{
      id: "task",
      startingCommit: repository.commit,
      prompt: "Create a new parser utility and focused tests.",
      completion: ["The parser works"],
      preferences: [{ requirement: "Use complete names", source: {
        relativePath: "profile.md", heading: "", line: 1,
      } }],
      profile,
      profileFingerprint: fingerprint(profile),
    }],
    engine: "codex",
    model: "gpt-5.6-luna",
    reasoningEffort: "medium",
    dependencyMode: "current",
    repeat: 1,
    timeoutSeconds: 60,
    maxBudgetUsd: null,
    dirtyFileCount: 0,
    preflight: [{ requirement: "Snapshot", verdict: "pass", evidence: "ok", votes: [] }],
  };
  const progress: EvaluationProgress[] = [];
  const contextPresence: boolean[] = [];
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
          contextPresence.push(await Bun.file(path.join(
            options.cwd,
            ".eval-context/skills/0/clean-code/SKILL.md",
          )).exists());
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
        return {
          engine: "codex",
          sessionId: "judge",
          transcriptPath: null,
          text: "",
          structured: candidate(),
          costUsd: null,
          durationMs: 1,
          turns: 1,
          actions: [],
          permissionDenials: [],
          isError: false,
          errorMessage: null,
        };
      },
    });
    expect(contextPresence.toSorted()).toEqual([false, true, true]);
    expect(firstCodingCallTimedOut).toBeFalse();
    const savedReceipt = readReceipt(await Bun.file(path.join(
      outputDirectory,
      "receipt.json",
    )).text());
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
    expect(progress.filter((event) => event.stage === "judging")).toHaveLength(3);
  } finally {
    await disposeSnapshotTemplates();
    await rm(repository.directory, { recursive: true, force: true });
    await rm(outputDirectory, { recursive: true, force: true });
    await rm(controlDirectory, { recursive: true, force: true });
  }
});
