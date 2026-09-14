import path from "node:path";
import { ownedWrite } from "../../storage";
import { publicReport } from "./publicReport";
import { fingerprint } from "./structured";
import type { PreparedEval, TransferReceipt } from "./types";

export async function saveReceipt(options: {
  readonly directory: string;
  readonly receipt: TransferReceipt;
}): Promise<void> {
  await ownedWrite({
    path: path.join(options.directory, "state.json"),
    content: JSON.stringify(options.receipt, null, 2),
  });
  await ownedWrite({
    path: path.join(options.directory, "report.json"),
    content: JSON.stringify(publicReport(options.receipt), null, 2),
  });
}

export function initialReceipt(prepared: PreparedEval): TransferReceipt {
  return {
    schemaVersion: 12,
    evalId: prepared.evalId,
    prepared,
    preparedFingerprint: fingerprint(prepared),
    runs: [],
    progress: {
      stage: "ready",
      taskIndex: null,
      taskCount: prepared.tasks.length,
      repeatIndex: null,
      repeatCount: prepared.repeat,
      arm: null,
      voteIndex: null,
      voteCount: null,
      updatedAt: new Date().toISOString(),
    },
    status: "running",
    limitations: [
      "Semantic judgments are automated and should be reproduced before publishing product claims.",
      "Repository guidance is available to all three arms. Skills and clone receive the frozen personal environment; only clone also receives the Shadowclone profile.",
      "Tasks start from the committed HEAD. Uncommitted source changes are deliberately excluded.",
      "Execution runs without network access, dependency installation, commits, pushes, or writes to the source repository.",
      "Three independent blinded votes per arm grade correctness and source-backed coding preferences separately. Every arm uses the same frozen preference denominator.",
      "The evaluator reviews bounded code changes directly and does not run the repository-wide test, typecheck, lint, or build graph.",
      "The configured model prepares, executes, and judges the suite. Reuse the suite ID to compare another engine on identical tasks.",
    ],
  };
}
