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
    schemaVersion: 2,
    evalId: prepared.evalId,
    prepared,
    preparedFingerprint: fingerprint(prepared),
    runs: [],
    status:
      prepared.tasks.length === 0 ? "insufficient-evidence" : "incomplete",
    limitations: [
      "Automatic semantic judgments are provisional and do not measure actual user correction time.",
      "Existing Markdown instructions, skills and memory are frozen and supplied to both arms. Native discovery and mutable memory are disabled; executable skill dependencies and custom hooks are not reproduced.",
      "Only requests with explicit starting-commit evidence qualify. Coverage may be low.",
      "Task outcomes are graded from observed files and actions; missing verification evidence remains uncertain.",
    ],
  };
}
