import path from "node:path";
import { canonicalPath, type ProjectPaths } from "../paths";
import { resolveRedacted } from "../redact";
import { readLocalText } from "../localFiles";
import { acquireLocalLock } from "../localFiles/lock";
import { commitLocalChanges, revisionTarget } from "./apply";
import { readRevision, revisionPath } from "./store";

export { commitLocalChanges } from "./apply";
export { listRevisions } from "./store";
export type { FileUpdate, LocalRevision } from "./types";

export async function showRevision(options: { readonly paths: ProjectPaths; readonly id: string }): Promise<string> {
  const sourcePath = revisionPath(options);
  const file = Bun.file(sourcePath);
  if (!(await file.exists())) throw new Error("Revision was not found");
  return resolveRedacted({ ref: { type: "file", sourcePath, byteOffset: 0, byteLength: file.size } });
}

export async function undoRevision(options: { readonly paths: ProjectPaths; readonly id: string; readonly skillRoots?: readonly string[] }): Promise<string | null> {
  const revision = await readRevision(options);
  const lock = await acquireLocalLock(path.join(options.paths.shadowcloneDirectory, revision.kind === "profile" ? "profile-write.db" : "skills-worker.db"));
  if (!lock) throw new Error("Another update is running; retry undo shortly");
  try {
  const allowed = revision.kind === "profile"
    ? [canonicalPath(options.paths.profileDirectory)]
    : (options.skillRoots ?? []).map(canonicalPath);
  if (!allowed.includes(canonicalPath(revision.root))) throw new Error("Revision root is not an authorized destination");
  const updates = [];
  for (const change of revision.changes) {
    if (revision.kind === "skill" && !change.relativePath.endsWith("/SKILL.md")) throw new Error("Invalid skill revision target");
    if (revision.kind === "profile" && !(change.relativePath === ".generated" || change.relativePath === ".rejected" || /^(global|org)\/.+\.md$/.test(change.relativePath.split(path.sep).join("/")))) {
      throw new Error("Invalid profile revision target");
    }
    const filePath = revisionTarget({ root: revision.root, relativePath: change.relativePath });
    const current = await readLocalText(filePath);
    if (current !== change.after && !(revision.status === "prepared" && current === change.before)) throw new Error("Revision conflicts with subsequent edits; files were preserved");
    updates.push({ filePath, next: change.before, previous: current });
  }
  return await commitLocalChanges({ paths: options.paths, root: revision.root, kind: revision.kind, updates });
  } finally { lock.release(); }
}
