import { z } from "zod";
import { transferRunSchema } from "./structured";
import type { TransferRun } from "./types";

const transferRunsSchema = z.array(transferRunSchema);

export function readRuns(value: unknown): readonly TransferRun[] {
  const parsed = transferRunsSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("Invalid saved runs");
  }
  return parsed.data;
}
