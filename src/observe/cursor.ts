import { stat } from "node:fs/promises";
import type { FileCursor, FileTextRef } from "./types";

type LineBoundaries = {
  readonly ref: FileTextRef;
  readonly bytes: Uint8Array;
};

export type JsonLine = {
  readonly value: unknown;
  readonly ref: FileTextRef;
};

export type CursorRead<Value> = {
  readonly values: readonly Value[];
  readonly cursor: FileCursor;
  readonly rescanned: boolean;
  readonly bytesRead: number;
  readonly invalidRecords: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissingFile(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}

async function getLineBoundaries(options: {
  readonly sourcePath: string;
  readonly cursor: FileCursor | null;
}): Promise<CursorRead<LineBoundaries> | null> {
  const fileStats = await stat(options.sourcePath).catch(
    (error: unknown): null => {
      if (isMissingFile(error)) {
        return null;
      }
      throw error;
    },
  );
  if (fileStats === null) {
    return null;
  }

  const modifiedAt = fileStats.mtimeMs;
  const previous = options.cursor;
  const unchanged =
    previous !== null &&
    previous.byteSize === fileStats.size &&
    previous.modifiedAt === modifiedAt;

  if (unchanged) {
    return {
      values: [],
      cursor: previous,
      rescanned: false,
      bytesRead: 0,
      invalidRecords: 0,
    };
  }

  const rescanned =
    previous !== null &&
    (fileStats.size < previous.byteOffset ||
      (fileStats.size === previous.byteSize &&
        modifiedAt !== previous.modifiedAt));
  const startOffset = previous === null || rescanned ? 0 : previous.byteOffset;
  const file = Bun.file(options.sourcePath);
  const bytes = new Uint8Array(
    await file.slice(startOffset, fileStats.size).arrayBuffer(),
  );
  const values: LineBoundaries[] = [];
  let lineStart = 0;
  let completedByteCount = 0;

  for (let byteIndex = 0; byteIndex < bytes.length; byteIndex += 1) {
    if (bytes[byteIndex] !== 10) {
      continue;
    }

    const hasCarriageReturn =
      byteIndex > lineStart && bytes[byteIndex - 1] === 13;
    const lineEnd = hasCarriageReturn ? byteIndex - 1 : byteIndex;
    const byteLength = lineEnd - lineStart;

    if (byteLength > 0) {
      values.push({
        ref: {
          type: "file",
          sourcePath: options.sourcePath,
          byteOffset: startOffset + lineStart,
          byteLength,
        },
        bytes: bytes.slice(lineStart, lineEnd),
      });
    }

    lineStart = byteIndex + 1;
    completedByteCount = lineStart;
  }

  return {
    values,
    cursor: {
      sourcePath: options.sourcePath,
      byteSize: fileStats.size,
      modifiedAt,
      byteOffset: startOffset + completedByteCount,
    },
    rescanned,
    bytesRead: bytes.length,
    invalidRecords: 0,
  };
}

export async function readJsonLines(options: {
  readonly sourcePath: string;
  readonly cursor: FileCursor | null;
}): Promise<CursorRead<JsonLine> | null> {
  const result = await getLineBoundaries(options);
  if (result === null) {
    return null;
  }

  const decoder = new TextDecoder();
  const values: JsonLine[] = [];
  let invalidRecords = 0;
  for (const line of result.values) {
    try {
      values.push({
        value: JSON.parse(decoder.decode(line.bytes)),
        ref: line.ref,
      });
    } catch {
      invalidRecords += 1;
    }
  }
  return { ...result, values, invalidRecords };
}

export async function readLineRefs(options: {
  readonly sourcePath: string;
  readonly cursor: FileCursor | null;
}): Promise<CursorRead<FileTextRef> | null> {
  const result = await getLineBoundaries(options);
  if (result === null) {
    return null;
  }

  return {
    ...result,
    values: result.values.map((line) => line.ref),
  };
}
