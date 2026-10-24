import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import type { LivePaths } from "./paths";
import { liveIdPattern, liveRecordSchema, pairIdPattern, type LiveRecord } from "./record";

const endedKeepMilliseconds = 86_400_000;

const staleMilliseconds = 7 * 86_400_000;

const senderSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("pairing"), pair: z.string().regex(pairIdPattern) }),
  z.object({
    kind: z.literal("peer"),
    pair: z.string().regex(pairIdPattern),
    session: z.string().regex(liveIdPattern),
  }),
]);

const inboxEntrySchema = z.object({
  at: z.string(),
  text: z.string(),
  from: senderSchema.optional(),
});

type InboxEntry = z.infer<typeof inboxEntrySchema>;

export type InboxMessage =
  | { readonly kind: "owner"; readonly text: string }
  | { readonly kind: "pairing"; readonly pair: string; readonly text: string }
  | {
      readonly kind: "peer";
      readonly pair: string;
      readonly session: string;
      readonly text: string;
    };

function entryOf(options: { readonly message: InboxMessage; readonly at: string }): InboxEntry {
  const { message, at } = options;

  switch (message.kind) {
    case "owner":
      return { at, text: message.text };
    case "pairing":
      return { at, text: message.text, from: { kind: "pairing", pair: message.pair } };
    case "peer":
      return {
        at,
        text: message.text,
        from: { kind: "peer", pair: message.pair, session: message.session },
      };
  }
}

function messageOf(entry: InboxEntry): InboxMessage {
  return entry.from === undefined
    ? { kind: "owner", text: entry.text }
    : { ...entry.from, text: entry.text };
}

function recordFile(options: { readonly paths: LivePaths; readonly id: string }): string {
  return path.join(options.paths.directory, `${options.id}.json`);
}

function inboxFile(options: { readonly paths: LivePaths; readonly id: string }): string {
  return path.join(options.paths.directory, `${options.id}.inbox.jsonl`);
}

async function ensureDirectory(paths: LivePaths): Promise<void> {
  await mkdir(paths.directory, { recursive: true, mode: 0o700 });
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export async function readRecord(options: {
  readonly paths: LivePaths;
  readonly id: string;
}): Promise<LiveRecord | null> {
  if (!liveIdPattern.test(options.id)) {
    return null;
  }

  const text = await readFile(recordFile(options), "utf8").catch(() => null);
  const record = text === null ? null : liveRecordSchema.safeParse(parseJson(text));

  return record?.success === true ? record.data : null;
}

export async function writeRecord(options: {
  readonly paths: LivePaths;
  readonly record: LiveRecord;
}): Promise<void> {
  await ensureDirectory(options.paths);

  const target = recordFile({ paths: options.paths, id: options.record.id });
  const temporary = `${target}.${randomUUID()}.tmp`;

  await writeFile(temporary, `${JSON.stringify(options.record)}\n`, { mode: 0o600 });
  await rename(temporary, target);
}

export async function listRecords(options: {
  readonly paths: LivePaths;
  readonly now: Date;
}): Promise<readonly LiveRecord[]> {
  const names = await readdir(options.paths.directory).catch(() => []);
  const records: LiveRecord[] = [];

  for (const name of names.filter((entry) => /^live-[0-9a-f]{8}\.json$/.test(entry))) {
    const record = await readRecord({ paths: options.paths, id: name.slice(0, -".json".length) });
    const age = record === null ? 0 : options.now.getTime() - new Date(record.updatedAt).getTime();

    if (
      record !== null &&
      ((record.state === "ended" && age > endedKeepMilliseconds) || age > staleMilliseconds)
    ) {
      await rm(recordFile({ paths: options.paths, id: record.id }), { force: true });
      await rm(inboxFile({ paths: options.paths, id: record.id }), { force: true });
    } else if (record !== null) {
      records.push(record);
    }
  }

  return records.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function refreshPending(paths: LivePaths): Promise<void> {
  const names = await readdir(paths.directory).catch(() => []);

  if (names.some((name) => name.endsWith(".inbox.jsonl"))) {
    await writeFile(paths.pendingMarker, "", { mode: 0o600 });
  } else {
    await rm(paths.pendingMarker, { force: true });
  }
}

export async function appendInbox(options: {
  readonly paths: LivePaths;
  readonly id: string;
  readonly message: InboxMessage;
  readonly now: Date;
}): Promise<void> {
  await ensureDirectory(options.paths);
  await writeFile(
    inboxFile(options),
    `${JSON.stringify(entryOf({ message: options.message, at: options.now.toISOString() }))}\n`,
    { flag: "a", mode: 0o600 },
  );
  await refreshPending(options.paths);
}

export async function takeInbox(options: {
  readonly paths: LivePaths;
  readonly id: string;
}): Promise<readonly InboxMessage[]> {
  const taking = `${inboxFile(options)}.${randomUUID()}.taking`;
  const moved = await rename(inboxFile(options), taking).then(
    () => true,
    () => false,
  );

  if (!moved) {
    return [];
  }

  const text = await readFile(taking, "utf8");

  await rm(taking, { force: true });
  await refreshPending(options.paths);

  return text
    .split("\n")
    .map((line) => inboxEntrySchema.safeParse(parseJson(line)))
    .flatMap((entry) => (entry.success ? [messageOf(entry.data)] : []));
}
