import type { Database } from "bun:sqlite";
import { lstat } from "node:fs/promises";
import { openReadonlyDatabase } from "../../readonlyDatabase";
import type { AgentEvent, CursorLookup, ObservationBatch } from "../../types";
import { listOpencodeSessions, type OpencodeSession } from "./sessions";
import { readVersionOneEvents, type OpencodeEventDraft } from "./versionOneEvents";
import { readVersionTwoEvents } from "./versionTwoEvents";

function readDrafts(options: {
  readonly database: Database;
  readonly session: OpencodeSession;
  readonly sourcePath: string;
}): readonly OpencodeEventDraft[] {
  return options.session.schema === "v2"
    ? readVersionTwoEvents(options)
    : readVersionOneEvents(options);
}

function toEvents(options: {
  readonly drafts: readonly OpencodeEventDraft[];
  readonly session: OpencodeSession;
}): readonly AgentEvent[] {
  const events: AgentEvent[] = [];
  let parentEventId: string | null = null;

  for (const { textBytes: _textBytes, ...draft } of options.drafts) {
    const event: AgentEvent = {
      ...draft,
      source: "opencode",
      sessionId: options.session.id,
      eventId: `${options.session.id}:${draft.eventId}`,
      parentEventId,
      cwd: options.session.directory,
      gitBranch: null,
    };

    events.push(event);
    parentEventId = event.eventId;
  }

  return events;
}

async function sessionBatch(options: {
  readonly database: Database;
  readonly session: OpencodeSession;
  readonly sourcePath: string;
  readonly getCursor: CursorLookup;
}): Promise<ObservationBatch | null> {
  const batchPath = `${options.sourcePath}#${options.session.id}`;
  const cursor = await options.getCursor(batchPath);

  if (cursor?.identity === options.session.signature) {
    return null;
  }

  const drafts = readDrafts(options);
  const bytesRead = drafts.reduce((total, draft) => total + draft.textBytes, 0);

  return {
    source: "opencode",
    sourcePath: batchPath,
    events: toEvents({ drafts, session: options.session }),
    cursor: {
      sourcePath: batchPath,
      identity: options.session.signature,
      byteSize: bytesRead,
      modifiedAt: options.session.updatedAt,
      byteOffset: bytesRead,
    },
    rescanned: cursor !== null,
    bytesRead,
    invalidRecords: 0,
  };
}

export async function observeOpencodeDatabase(options: {
  readonly sourcePath: string;
  readonly getCursor: CursorLookup;
}): Promise<readonly ObservationBatch[]> {
  const metadata = await lstat(options.sourcePath).catch(() => null);

  if (!metadata?.isFile() || metadata.isSymbolicLink()) {
    return [];
  }

  let database: Database | null = null;

  try {
    database = openReadonlyDatabase(options.sourcePath);

    const batches: ObservationBatch[] = [];

    for (const session of listOpencodeSessions(database)) {
      const batch = await sessionBatch({ ...options, database, session });

      if (batch !== null) {
        batches.push(batch);
      }
    }

    return batches;
  } catch {
    console.warn("opencode: skipped an unreadable session database");

    return [];
  } finally {
    database?.close();
  }
}
