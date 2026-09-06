import { fingerprint, parseJson, receiptSchema } from "./structured";
import type { TransferReceipt } from "./types";

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
  return {
    ...receipt,
    status: "incomplete",
  };
}
