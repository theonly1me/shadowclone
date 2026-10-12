import path from "node:path";
import type { ProjectPaths } from "@shadowclone/core";
import { resolveRedacted } from "@shadowclone/sessions";
import { revisionPath } from "./store";

export { commitLocalChanges, revisionTarget } from "./apply";
export { listRevisions } from "./store";
export { readRevision } from "./store";
export type { FileUpdate, LocalRevision } from "./types";

export async function showRevision(options: {
  readonly paths: ProjectPaths;
  readonly id: string;
}): Promise<string> {
  const sourcePath = revisionPath(options);
  const file = Bun.file(sourcePath);

  if (!(await file.exists())) {
    throw new Error("Revision was not found");
  }

  const details = await resolveRedacted({
    ref: { type: "file", sourcePath, byteOffset: 0, byteLength: file.size },
    roots: [path.dirname(sourcePath)],
  });

  if (details.length === 0) {
    throw new Error(`Revision ${options.id} could not be read; it may exceed the size limit`);
  }

  return details;
}
