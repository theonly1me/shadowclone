import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { withEvaluationDeadline } from "./deadline";
import { executeTransferRuns } from "./executeRuns";
import { batchReply, judgeRequest } from "./judgeFixtures";
import { evidenceReceipt } from "./recoveryFixtures";
import { readReceipt } from "./resume";

test("hard deadline persists timeout and checkpoints even when the judge ignores cancellation", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-judge-deadline-"));
  const releases: (() => void)[] = [];
  try {
    await expect(withEvaluationDeadline({
      enabled: true, durationMs: 200,
      operation: async () => executeTransferRuns({
        receipt: evidenceReceipt(directory), directory, controlDirectory: directory,
        json: false, startedAt: Date.now(),
        call: async (request) => {
          if (judgeRequest(request.prompt).kind === "preferences") {
            await new Promise<void>((resolve) => releases.push(resolve));
          }
          return batchReply(request);
        },
      }),
    })).rejects.toThrow("wall-clock limit");
    const receiptPath = path.join(directory, "receipt.json");
    const frozen = await Bun.file(receiptPath).text();
    const saved = readReceipt(frozen);
    expect(saved.status).toBe("error");
    expect(saved.progress?.stage).toBe("timeout");
    expect(saved.runs.every((run) => run.judging?.completed.length === 1)).toBeTrue();
    for (const release of releases) release();
    await Bun.sleep(30);
    expect(await Bun.file(receiptPath).text()).toBe(frozen);
    let calls = 0;
    const resumed = await executeTransferRuns({
      receipt: saved, directory, controlDirectory: directory, json: false, startedAt: Date.now(),
      call: async (request) => {
        expect(request.access).toBe("none");
        calls += 1;
        return batchReply(request);
      },
    });
    expect(calls).toBe(15);
    expect(resumed.status).toBe("complete");
  } finally {
    for (const release of releases) release();
    await rm(directory, { recursive: true, force: true });
  }
});
