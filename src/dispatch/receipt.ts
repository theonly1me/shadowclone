import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { RunReceipt } from "./types";

export async function writeReceipt(options: {
  readonly runDirectory: string;
  readonly receipt: RunReceipt;
}): Promise<string> {
  await mkdir(options.runDirectory, { recursive: true });
  const receiptPath = path.join(options.runDirectory, "receipt.json");
  await Bun.write(
    receiptPath,
    `${JSON.stringify(options.receipt, null, 2)}\n`,
  );
  return receiptPath;
}
