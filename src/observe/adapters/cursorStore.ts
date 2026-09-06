import { Database } from "bun:sqlite";
import { stat } from "node:fs/promises";
import path from "node:path";
import {
  isRecord,
  readString,
  readTimestamp,
} from "../record";
import type { FileCursor } from "../types";

export type CursorBlob = {
  readonly id: string;
  readonly value: unknown;
};

export type CursorStore = {
  readonly blobs: readonly CursorBlob[];
  readonly sessionId: string;
  readonly cwd: string;
  readonly timestamp: number;
  readonly cursor: FileCursor;
  readonly bytesRead: number;
};

type BlobRow = {
  readonly id: string;
  readonly data: Uint8Array;
};

type MetaRow = {
  readonly value: string;
};

type FileStats = {
  readonly size: number;
  readonly modifiedAt: number;
};

async function fileStats(sourcePath: string): Promise<FileStats | null> {
  try {
    const result = await stat(sourcePath);
    return { size: result.size, modifiedAt: result.mtimeMs };
  } catch {
    return null;
  }
}

function decodeMeta(value: string): unknown {
  const text = /^(?:[0-9a-fA-F]{2})+$/.test(value)
    ? new TextDecoder().decode(
        Uint8Array.from(
          value.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? [],
        ),
      )
    : value;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function decodeBlob(data: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(data));
  } catch {
    return null;
  }
}

async function readSidecar(sourcePath: string): Promise<unknown> {
  const sidecar = Bun.file(path.join(path.dirname(sourcePath), "meta.json"));
  if (!(await sidecar.exists())) {
    return null;
  }
  try {
    return JSON.parse(await sidecar.text());
  } catch {
    return null;
  }
}

export async function cursorStoreSignature(
  sourcePath: string,
): Promise<FileStats | null> {
  const database = await fileStats(sourcePath);
  if (database === null) {
    return null;
  }
  const [writeAheadLog, sidecar] = await Promise.all([
    fileStats(`${sourcePath}-wal`),
    fileStats(path.join(path.dirname(sourcePath), "meta.json")),
  ]);
  const files = [database, writeAheadLog, sidecar].filter(
    (entry) => entry !== null,
  );
  return {
    size: files.reduce((total, entry) => total + entry.size, 0),
    modifiedAt: Math.max(...files.map((entry) => entry.modifiedAt)),
  };
}

function openCursorDatabase(sourcePath: string): Database {
  let primary: Database | null = null;
  try {
    primary = new Database(sourcePath, {
      readonly: true,
      strict: true,
    });
    primary.query("SELECT 1").get();
    return primary;
  } catch {
    primary?.close();
    let fallback: Database | null = null;
    try {
      fallback = new Database(`file:${sourcePath}?mode=ro&immutable=1`, {
        strict: true,
      });
      fallback.query("SELECT 1").get();
      return fallback;
    } catch (error) {
      fallback?.close();
      throw error;
    }
  }
}

export async function readCursorStore(options: {
  readonly sourcePath: string;
  readonly signature: FileStats;
}): Promise<CursorStore | null> {
  let database: Database | null = null;
  try {
    database = openCursorDatabase(options.sourcePath);
    const blobs = database
      .query<BlobRow, []>("SELECT id, data FROM blobs ORDER BY rowid")
      .all()
      .flatMap((row) => {
        const value = decodeBlob(row.data);
        return value === null ? [] : [{ id: row.id, value }];
      });
    const storedMeta = decodeMeta(
      database
        .query<MetaRow, []>("SELECT value FROM meta WHERE key = '0'")
        .get()?.value ?? "",
    );
    const sidecar = await readSidecar(options.sourcePath);
    const storedRecord = isRecord(storedMeta) ? storedMeta : {};
    const sidecarRecord = isRecord(sidecar) ? sidecar : {};
    return {
      blobs,
      sessionId:
        readString(storedRecord, "agentId") ??
        path.basename(path.dirname(options.sourcePath)),
      cwd: readString(sidecarRecord, "cwd") ?? "",
      timestamp:
        readTimestamp(sidecarRecord.createdAtMs) ||
        readTimestamp(storedRecord.createdAt) ||
        options.signature.modifiedAt,
      cursor: {
        sourcePath: options.sourcePath,
        byteSize: options.signature.size,
        modifiedAt: options.signature.modifiedAt,
        byteOffset: options.signature.size,
      },
      bytesRead: options.signature.size,
    };
  } catch {
    console.warn(
      `cursor: skipped an unreadable store (${options.signature.size} bytes)`,
    );
    return null;
  } finally {
    database?.close();
  }
}
