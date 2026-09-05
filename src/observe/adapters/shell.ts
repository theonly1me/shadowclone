import path from "node:path";
import { readLineRefs } from "../cursor";
import type {
  FileCursor,
  ObservationBatch,
} from "../types";

export async function observeShellFile(options: {
  readonly sourcePath: string;
  readonly cursor: FileCursor | null;
}): Promise<ObservationBatch | null> {
  const result = await readLineRefs(options);
  if (result === null) {
    return null;
  }

  return {
    source: "shell",
    sourcePath: path.resolve(options.sourcePath),
    events: result.values.map((textRef) => ({
      source: "shell",
      sessionId: "shell-history",
      eventId: `shell:${textRef.byteOffset}`,
      parentEventId: null,
      timestamp: result.cursor.modifiedAt,
      cwd: "",
      gitBranch: null,
      kind: "user-prompt",
      tool: null,
      isError: false,
      textRef,
    })),
    cursor: result.cursor,
    rescanned: result.rescanned,
    bytesRead: result.bytesRead,
  };
}
