import path from "node:path";
import { ownedWrite } from "../storage";
import type { RunReceipt } from "./types";

export async function writeReceipt(options: {
  readonly runDirectory: string;
  readonly receipt: RunReceipt;
}): Promise<string> {
  const receiptPath = path.join(options.runDirectory, "receipt.json");
  await ownedWrite({
    path: receiptPath,
    content: `${JSON.stringify(options.receipt, null, 2)}\n`,
  });
  return receiptPath;
}
