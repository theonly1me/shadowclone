import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { executeTransferRuns } from "./executeRuns";
import { batchReply, judgeRequest } from "./judgeFixtures";
import { evidenceReceipt } from "./recoveryFixtures";
import { readReceipt } from "./resume";
import { reportLines } from "./report";

test("persists completed votes and resumes only missing judging without coding", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-judge-recovery-"));
  try {
    const options = { directory, controlDirectory: directory, json: false, startedAt: Date.now() };
    await expect(executeTransferRuns({
      ...options, receipt: evidenceReceipt(directory),
      call: async (request) => {
        expect(request.access).toBe("none");
        const parsed = judgeRequest(request.prompt);
        if (parsed.candidate.includes("bare") && parsed.vote === 2 && parsed.kind === "correctness") {
          throw new Error("Judge transport interrupted");
        }
        return batchReply(request);
      },
    })).rejects.toThrow("Resume with --eval-id");
    const saved = readReceipt(await Bun.file(path.join(directory, "receipt.json")).text());
    const bare = saved.runs.find((run) => run.arm === "bare");
    expect(saved.status).toBe("error");
    expect(bare?.failureStage).toBe("judging");
    expect(bare?.judging?.completed).toHaveLength(2);
    expect(bare?.judging?.pending).toHaveLength(4);
    expect(bare?.judging?.attempts.filter((attempt) => attempt.state === "error")).toHaveLength(3);
    expect(saved.runs.filter((run) => run.phase === "complete")).toHaveLength(2);
    expect(reportLines(saved).find((line) => line.startsWith("  bare"))).toContain("ungraded");
    let resumedCalls = 0;
    const completed = await executeTransferRuns({
      ...options, receipt: saved,
      call: async (request) => {
        expect(request.access).toBe("none");
        resumedCalls += 1;
        return batchReply(request);
      },
    });
    expect(resumedCalls).toBe(4);
    expect(completed.status).toBe("complete");
    expect(completed.runs.every((run) => run.failure === null && run.judging?.pending.length === 0)).toBeTrue();
    expect(completed.runs.every((run) => run.preferences.every((check) => check.votes.length === 3))).toBeTrue();
    expect(reportLines(completed).join("\n")).toContain("Profile improvement: not demonstrated");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
