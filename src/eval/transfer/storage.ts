import { publicReport } from "./publicReport";
import path from "node:path";
import { ownedWrite } from "../../storage";
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
    schemaVersion: 3,
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
