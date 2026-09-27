import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { withEvaluationDeadline } from "./deadline";
import { executeTransferRuns } from "./executeRuns";
import { batchReply, judgeRequest } from "./judgeFixtures";
import { judgeWork } from "./judgeWork";
import { evidenceReceipt } from "./recoveryFixtures";
import { readReceipt } from "./resume";
import type { TransferReceipt } from "./types";

function receiptWithCompletedVotes(directory: string): TransferReceipt {
  const receipt = evidenceReceipt(directory);
  const [task] = receipt.prepared.tasks;

  if (!task) {
    throw new Error("Evaluation task is missing");
  }

  return {
    ...receipt,
    runs: receipt.runs.map((run) => {
      if (run.observed === null) {
        throw new Error("Judge evidence is missing");
      }

      const [completed, ...pending] = judgeWork({
        taskPrompt: task.prompt,
        correctness: task.completion,
        preferences: task.preferences,
        evidence: run.observed,
      });

      if (completed?.kind !== "correctness") {
        throw new Error("Correctness judge work is missing");
      }

      return {
        ...run,
        judging: {
          completed: [
            {
              ...completed,
              checks: completed.criteria.map((id) => ({
                id,
                verdict: "pass" as const,
                evidence: "parser.ts satisfies the criterion",
              })),
            },
          ],
          pending,
          attempts: [],
        },
      };
    }),
  };
}

test("hard deadline persists timeout and checkpoints even when the judge ignores cancellation", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-judge-deadline-"),
  );
  const releases: (() => void)[] = [];
  let execution: Promise<TransferReceipt> | undefined;

  try {
    await expect(
      withEvaluationDeadline({
        enabled: true,
        durationMs: 2_000,
        operation: () => {
          execution = executeTransferRuns({
            receipt: receiptWithCompletedVotes(directory),
            directory,
            controlDirectory: directory,
            json: false,
            startedAt: Date.now(),
            call: async (request) => {
              if (judgeRequest(request.prompt).kind === "preferences") {
                await new Promise<void>((resolve) => releases.push(resolve));
              }

              return batchReply(request);
            },
          });

          return execution;
        },
      }),
    ).rejects.toThrow("wall-clock limit");

    expect(releases.length).toBeGreaterThan(0);

    const receiptPath = path.join(directory, "state.json");
    const frozen = await Bun.file(receiptPath).text();
    const saved = readReceipt(frozen);

    expect(saved.status).toBe("error");
    expect(saved.progress?.stage).toBe("timeout");
    expect(
      saved.runs.every((run) => run.judging?.completed.length === 1),
    ).toBeTrue();

    for (const release of releases) {
      release();
    }

    await execution?.catch(() => undefined);

    expect(await Bun.file(receiptPath).text()).toBe(frozen);

    let calls = 0;

    const resumed = await executeTransferRuns({
      receipt: saved,
      directory,
      controlDirectory: directory,
      json: false,
      startedAt: Date.now(),
      call: async (request) => {
        expect(request.access).toBe("none");

        calls += 1;

        return batchReply(request);
      },
    });

    expect(calls).toBe(15);
    expect(resumed.status).toBe("complete");
  } finally {
    for (const release of releases) {
      release();
    }

    await execution?.catch(() => undefined);
    await rm(directory, { recursive: true, force: true });
  }
}, 15_000);
