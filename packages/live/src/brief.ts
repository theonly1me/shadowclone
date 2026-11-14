import { z } from "zod";
import { fingerprint } from "@shadowclone/core";
import { liveFile, readJsonFile, writePrivateJson } from "./files";
import type { LivePaths } from "./paths";
import { liveIdPattern } from "./board";
import type { LiveRecord } from "./record";

export const liveBriefKinds = ["question", "finished", "blocked"] as const;

export const liveBriefSchema = z.strictObject({
  name: z.string(),
  goal: z.string(),
  done: z.string(),
  kind: z.enum(liveBriefKinds),
  question: z.string().nullable(),
  options: z.array(z.string()).max(4),
  messageDigest: z.string(),
  writtenAt: z.string(),
});

export type LiveBrief = z.infer<typeof liveBriefSchema>;

const briefCallsSchema = z.strictObject({ calls: z.array(z.string()) });

type SessionFile = { readonly paths: LivePaths; readonly id: string };

export function briefMessageDigest(lastMessage: string): string {
  return fingerprint(lastMessage);
}

export function briefIsCurrent(options: {
  readonly record: LiveRecord;
  readonly brief: LiveBrief;
}): boolean {
  return (
    options.record.state === "idle" &&
    options.brief.messageDigest === briefMessageDigest(options.record.summary)
  );
}

export async function readBrief(options: SessionFile): Promise<LiveBrief | null> {
  if (!liveIdPattern.test(options.id)) {
    return null;
  }

  const brief = liveBriefSchema.safeParse(
    await readJsonFile(liveFile({ ...options, kind: "brief" })),
  );

  return brief.success ? brief.data : null;
}

export async function saveBrief(options: SessionFile & { readonly brief: LiveBrief }): Promise<void> {
  await writePrivateJson({
    paths: options.paths,
    file: liveFile({ ...options, kind: "brief" }),
    value: options.brief,
  });
}

export async function readBriefCalls(options: SessionFile): Promise<readonly string[]> {
  const calls = briefCallsSchema.safeParse(
    await readJsonFile(liveFile({ ...options, kind: "briefCalls" })),
  );

  return calls.success ? calls.data.calls : [];
}

export async function saveBriefCalls(
  options: SessionFile & { readonly calls: readonly string[] },
): Promise<void> {
  await writePrivateJson({
    paths: options.paths,
    file: liveFile({ ...options, kind: "briefCalls" }),
    value: { calls: options.calls },
  });
}

export function briefLockFile(options: SessionFile): string {
  return liveFile({ ...options, kind: "briefLock" });
}
