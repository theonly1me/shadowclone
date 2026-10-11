import path from "node:path";
import { createHash } from "node:crypto";
import { ownedFile, ownedWrite } from "@shadowclone/core";
import { z } from "zod";
import { preparedReviewSchema, type DraftRequest } from "./schema";

export const draftReceiptSchema = z.object({
  operation: z.string(),
  login: z.string(),
  repository: z.string(),
  number: z.number(),
  headSha: z.string(),
  baseSha: z.string(),
  prepared: preparedReviewSchema,
  state: z.enum(["prepared", "creating", "written", "verified"]),
  reviewId: z.number().nullable(),
  url: z.string().nullable(),
});
export type DraftReceipt = z.infer<typeof draftReceiptSchema>;

export function draftOperation(request: DraftRequest): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        reportId: request.reportId,
        pr: request.pr,
        notes: request.notes.toSorted((left, right) => left.id.localeCompare(right.id)),
      }),
    )
    .digest("hex");
}

export function receiptPath(options: {
  readonly directory: string;
  readonly operation: string;
}): string {
  return path.join(options.directory, options.operation + ".json");
}

export async function readDraftReceipt(file: string): Promise<DraftReceipt | null> {
  if (!(await Bun.file(file).exists())) return null;
  await ownedFile(file);
  return draftReceiptSchema.parse(await Bun.file(file).json());
}

export async function writeDraftReceipt(options: {
  readonly file: string;
  readonly receipt: DraftReceipt;
}): Promise<void> {
  await ownedWrite({ path: options.file, content: JSON.stringify(options.receipt) });
}
