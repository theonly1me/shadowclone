import { receiptSchema } from "./receiptSchema";
import { fingerprint, parseJson } from "./structured";
import type { TransferOptions, TransferReceipt } from "./types";

export function readReceipt(text: string): TransferReceipt {
  const json = parseJson(text);
  const parsed = receiptSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Unsupported evaluation receipt");
  }
  const receipt = parsed.data;
  if (receipt.preparedFingerprint !== fingerprint(receipt.prepared)) {
    throw new Error("Invalid or modified frozen evaluation");
  }
  for (const task of receipt.prepared.tasks) {
    if (task.profileFingerprint !== fingerprint(task.profile)) {
      throw new Error("Modified frozen profile");
    }
  }
  return receipt;
}

export function validateResumeOptions(options: {
  readonly receipt: TransferReceipt;
  readonly requested: TransferOptions;
  readonly repository: string;
  readonly commit: string;
}): void {
  const prepared = options.receipt.prepared;
  if (prepared.repository !== options.repository) {
    throw new Error("Evaluation resume requires its original repository");
  }
  if (prepared.baseCommit !== options.commit) {
    throw new Error("Evaluation resume requires its original repository HEAD");
  }
  if (options.requested.task || options.requested.suiteId) {
    throw new Error("Evaluation resume cannot select a new task or suite");
  }
  const mismatched = [
    options.requested.engine !== undefined &&
      options.requested.engine !== prepared.engine,
    options.requested.model !== undefined &&
      options.requested.model !== prepared.model,
    options.requested.reasoningEffort !== undefined &&
      options.requested.reasoningEffort !== prepared.reasoningEffort,
    options.requested.tasks !== undefined &&
      options.requested.tasks !== prepared.tasks.length,
    options.requested.repeat !== undefined &&
      options.requested.repeat !== prepared.repeat,
    options.requested.timeoutSeconds !== undefined &&
      options.requested.timeoutSeconds !== prepared.timeoutSeconds,
    options.requested.maxBudgetUsd !== undefined &&
      options.requested.maxBudgetUsd !== prepared.maxBudgetUsd,
  ].some(Boolean);
  if (mismatched) {
    throw new Error("Evaluation resume settings do not match the frozen run");
  }
}
