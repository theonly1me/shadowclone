import { expect, test } from "bun:test";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { lockEvaluation } from "./lock";
import { evidenceReceipt } from "./recoveryFixtures";
import { initialReceipt, saveReceipt } from "./storage";

test("public reports omit private content while resume state retains it privately", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-report-"),
  );
  try {
    const receipt = initialReceipt({
      ...evidenceReceipt(directory).prepared,
      evalId: "private-eval-name",
      repository: "/private/project",
      engine: "claude-code",
      model: "sonnet",
      repeat: 1,
      timeoutSeconds: 30,
      maxBudgetUsd: 2,
      context: [{ relativePath: "CLAUDE.md", content: "private-context" }],
      tasks: [
        {
          id: "private-task",
          startingCommit: "a".repeat(40),
          prompt: "private-prompt",
          completion: ["private-requirement"],
          preferences: [],
          profile: "private-profile",
          profileFingerprint: "b".repeat(64),
        },
      ],
    });
    await saveReceipt({
      directory,
      receipt: {
        ...receipt,
        runs: [
          {
            ...evidenceReceipt(directory).runs[0],
            taskId: "private-task",
            repeat: 0,
            arm: "clone",
            phase: "complete",
            failureStage: "judging",
            observed: "private-code",
            verification: [],
            safety: [],
            dependencyState: "not-required",
            sessionId: "private-session",
            failure: "private-error",
            durationMs: 1,
            costUsd: 0.1,
            correctness: [
              {
                requirement: "private-requirement",
                verdict: "fail",
                evidence: "private-evidence",
                votes: [],
              },
            ],
            preferences: [],
          },
        ],
      },
    });
    const report = await Bun.file(path.join(directory, "report.json")).text();
    expect(report).not.toContain("private-");
    expect(report).not.toContain("/private/project");
    expect(JSON.parse(report).runs[0].correctness).toEqual(["fail"]);
    expect(await Bun.file(path.join(directory, "state.json")).text()).toContain(
      "private-prompt",
    );
    expect((await stat(path.join(directory, "state.json"))).mode & 0o777).toBe(
      0o600,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("evaluation ownership is exclusive and release permits a later resume", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-eval-lock-"),
  );
  try {
    const release = await lockEvaluation(directory);
    await expect(lockEvaluation(directory)).rejects.toThrow("interrupted lock");
    await release();
    const nextRelease = await lockEvaluation(directory);
    await nextRelease();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
