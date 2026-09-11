import { Database } from "bun:sqlite";
import path from "node:path";
import type { ShadowcloneConfig } from "../config";
import { observeAll } from "../observe";
import { observeClaudeCodeFile } from "../observe/adapters/claudeCode";
import type { ProjectPaths } from "../paths";
import { ownedDirectory, ownedFile } from "../storage";
import { createSchema } from "./schema";
import { EventIndex } from "./store";
import type { IngestSummary } from "./types";

export { EventIndex } from "./store";
export type { BoundRepository } from "./originBinding";
export type {
  CorpusSummary,
  IndexedEvent,
  IngestSummary,
} from "./types";

export async function openEventIndex(
  databasePath: string,
): Promise<EventIndex> {
  if (databasePath !== ":memory:") {
    await ownedDirectory(path.dirname(databasePath));
    for (const suffix of ["", "-wal", "-shm"]) {
      await ownedFile(`${databasePath}${suffix}`);
    }
  }
  const database = new Database(databasePath, { create: true });
  createSchema(database);
  for (const suffix of databasePath === ":memory:"
    ? []
    : ["", "-wal", "-shm"]) {
    await ownedFile(`${databasePath}${suffix}`);
  }
  return new EventIndex(database);
}

export async function ingestSources(options: {
  readonly index: EventIndex;
  readonly config: ShadowcloneConfig;
  readonly paths: ProjectPaths;
}): Promise<IngestSummary> {
  let files = 0;
  let events = 0;
  let bytesRead = 0;
  let rescannedFiles = 0;
  let omittedRecords = 0;

  for await (const batch of observeAll({
    config: options.config,
    paths: options.paths,
    getCursor: (sourcePath) => options.index.getCursor(sourcePath),
  })) {
    const previous = options.index.getCursor(batch.sourcePath);
    omittedRecords += Math.max(
      0,
      (batch.cursor.omittedRecords ?? 0) -
        (batch.rescanned ? 0 : (previous?.omittedRecords ?? 0)),
    );
    options.index.saveBatch(batch);
    files += 1;
    events += batch.events.length;
    bytesRead += batch.bytesRead;
    rescannedFiles += batch.rescanned ? 1 : 0;
  }

  return {
    files,
    events,
    sessions: options.index.countSessions(),
    bytesRead,
    rescannedFiles,
    omittedRecords,
  };
}

export async function ingestClaudeTranscript(options: {
  readonly index: EventIndex;
  readonly sourcePath: string;
}): Promise<number> {
  const batch = await observeClaudeCodeFile({
    sourcePath: options.sourcePath,
    cursor: options.index.getCursor(options.sourcePath),
  });
  if (batch === null) {
    return 0;
  }
  options.index.saveBatch(batch);
  return batch.events.length;
}
