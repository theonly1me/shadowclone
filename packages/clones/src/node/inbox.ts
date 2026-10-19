import { appendFile } from "node:fs/promises";
import path from "node:path";
import { ownedDirectory } from "@shadowclone/core";
import { z } from "zod";
import type { ClonesPaths } from "../config/store";
import { questionIdPattern } from "./progress";
import { runDirectory } from "./store";

export const maximumMessageLength = 8000;

export const inboxEntrySchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("message"),
    at: z.string(),
    text: z.string().min(1).max(maximumMessageLength),
  }),
  z.strictObject({
    kind: z.literal("answer"),
    at: z.string(),
    question: z.string().regex(questionIdPattern),
    text: z.string().min(1).max(4000),
  }),
]);

export type InboxEntry = z.infer<typeof inboxEntrySchema>;

function inboxFile(options: { readonly paths: ClonesPaths; readonly id: string }): string {
  return path.join(runDirectory(options), "inbox.jsonl");
}

export async function appendInbox(options: {
  readonly paths: ClonesPaths;
  readonly id: string;
  readonly entry: InboxEntry;
}): Promise<void> {
  await ownedDirectory(runDirectory(options));
  await appendFile(
    inboxFile(options),
    `${JSON.stringify(inboxEntrySchema.parse(options.entry))}\n`,
    {
      mode: 0o600,
    },
  );
}

export async function readInbox(options: {
  readonly paths: ClonesPaths;
  readonly id: string;
}): Promise<readonly InboxEntry[]> {
  const file = Bun.file(inboxFile(options));

  if (!(await file.exists())) {
    return [];
  }

  const completeLines = (await file.text()).split("\n").slice(0, -1);

  return completeLines
    .filter((line) => line.trim() !== "")
    .flatMap((line) => {
      try {
        const parsed = inboxEntrySchema.safeParse(JSON.parse(line));

        return parsed.success ? [parsed.data] : [];
      } catch {
        return [];
      }
    });
}
