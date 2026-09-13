import { mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { fingerprint } from "./structured";
import type { PreparedEval, TransferReceipt } from "./types";

export async function saveReceipt(options: {
  readonly directory: string;
  readonly receipt: TransferReceipt;
}): Promise<void> {
  await mkdir(options.directory, { recursive: true, mode: 0o700 });
  const temporaryPath = path.join(
    options.directory,
    `${crypto.randomUUID()}.tmp`,
  );
  await Bun.write(temporaryPath, JSON.stringify(options.receipt, null, 2), {
    mode: 0o600,
  });
  await rename(temporaryPath, path.join(options.directory, "receipt.json"));
}

export function initialReceipt(prepared: PreparedEval): TransferReceipt {
  return {
    schemaVersion: 9,
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
      "Repository guidance is available to both arms. Only the clone arm receives the frozen personal agent environment and Shadowclone profile.",
      "Tasks start from the committed HEAD. Uncommitted source changes are deliberately excluded.",
      "Execution runs without network access, dependency installation, commits, pushes, or writes to the source repository.",
      "Three blinded paired code-review votes grade correctness and preference adherence. Missing evidence is a failure, while malformed evidence is an infrastructure error.",
      "The evaluator reviews bounded code changes directly and does not run the repository-wide test, typecheck, lint, or build graph.",
      "The configured model prepares, executes, and judges the suite. Reuse the suite ID to compare another engine on identical tasks.",
    ],
  };
}
