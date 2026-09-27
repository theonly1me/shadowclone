import { readLocalText } from "../../../localFiles";
import path from "node:path";
import { readRevision } from "../../../changes";
import { readBoundedFile } from "../../../io/files";
import { canonicalPath, type ProjectPaths } from "../../../paths";
import { fingerprint } from "../../transfer/structured";
import { maintenanceManifestSchema, type MaintenanceManifest } from "./schema";

export function maintenanceManifestPath(options: {
  readonly paths: ProjectPaths;
  readonly suiteId: string;
}): string {
  return path.join(
    options.paths.shadowcloneDirectory,
    "eval-suites",
    `${options.suiteId}.maintenance.json`,
  );
}

export async function readMaintenanceManifest(options: {
  readonly paths: ProjectPaths;
  readonly suiteId: string;
}): Promise<MaintenanceManifest> {
  const filePath = maintenanceManifestPath(options);
  const text = await readBoundedFile({
    filePath,
    roots: [options.paths.shadowcloneDirectory],
    maximumBytes: 16384,
  });

  if (!text) {
    throw new Error("Maintenance source manifest is missing");
  }

  return maintenanceManifestSchema.parse(JSON.parse(text));
}

export async function verifyMaintenanceRevision(options: {
  readonly paths: ProjectPaths;
  readonly manifest: MaintenanceManifest;
}): Promise<void> {
  const revision = await readRevision({
    paths: options.paths,
    id: options.manifest.delta.revisionId,
  });
  const [change] = revision.changes;

  if (
    revision.kind !== "profile" ||
    revision.status !== "applied" ||
    canonicalPath(revision.root) !==
      canonicalPath(options.paths.profileDirectory) ||
    revision.changes.length !== 1 ||
    !change?.before ||
    !change.after ||
    change.relativePath !== options.manifest.delta.relativePath ||
    fingerprint(change.before) !== options.manifest.delta.beforeHash ||
    fingerprint(change.after) !== options.manifest.delta.afterHash
  ) {
    throw new Error("Maintenance revision provenance changed");
  }
}

export async function verifyMaintainedReference(options: {
  readonly paths: ProjectPaths;
  readonly manifest: MaintenanceManifest;
}): Promise<void> {
  if (
    fingerprint(
      await readLocalText(
        path.join(
          options.paths.profileDirectory,
          options.manifest.delta.relativePath,
        ),
      ),
    ) !== options.manifest.delta.afterHash
  ) {
    throw new Error("Managed reference changed after maintenance");
  }
}
