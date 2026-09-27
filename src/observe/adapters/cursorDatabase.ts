import { Database } from "bun:sqlite";
import { stat } from "node:fs/promises";
import path from "node:path";

export type FileStats = {
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

export function openCursorDatabase(sourcePath: string): Database {
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
