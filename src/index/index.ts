import { Database } from "bun:sqlite";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { ShadowcloneConfig } from "../config";
import { observeAll } from "../observe";
import type { ProjectPaths } from "../paths";
import { createSchema } from "./schema";
import { EventIndex } from "./store";
import type { IngestSummary } from "./types";

export { EventIndex } from "./store";
export type {
  CorpusSummary,
  IndexedEvent,
  IngestSummary,
} from "./types";

export async function openEventIndex(databasePath: string): Promise<EventIndex> {
  await mkdir(path.dirname(databasePath), { recursive: true });
  const database = new Database(databasePath, { create: true });
  createSchema(database);
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

  for await (const batch of observeAll({
    config: options.config,
    paths: options.paths,
    getCursor: (sourcePath) => options.index.getCursor(sourcePath),
  })) {
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
  };
}
