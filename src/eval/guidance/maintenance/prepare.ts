import path from "node:path";
import { commitLocalChanges } from "../../../changes";
import { readLocalText } from "../../../localFiles";
import { acquireLocalLock } from "../../../localFiles/lock";
import type { ProjectPaths } from "../../../paths";
import { parseReference, referenceRelativePath } from "../../../references";
import { ownedWrite } from "../../../storage";
import { command } from "../../transfer/command";
import { fingerprint } from "../../transfer/structured";
import {
  readGuidanceReceipt,
  readGuidanceSuite,
  saveGuidanceSuite,
} from "../store";
import {
  correctedPath,
  deriveMaintenanceSuite,
  incorrectPath,
  maintenanceIdentity,
  referencePath,
  validateMaintenanceDelta,
} from "./change";
import { maintenanceManifestSchema, type MaintenanceManifest } from "./schema";
import {
  maintenanceManifestPath,
  readMaintenanceManifest,
  verifyMaintenanceRevision,
  verifyMaintainedReference,
} from "./manifest";

export {
  maintenanceManifestPath,
  readMaintenanceManifest,
  verifyMaintenanceRevision,
} from "./manifest";

export async function prepareMaintenanceSuite(options: {
  readonly paths: ProjectPaths;
  readonly parentEvalId: string;
}): Promise<{ suiteId: string; manifest: MaintenanceManifest }> {
  const parent = await readGuidanceReceipt({
    paths: options.paths,
    evalId: options.parentEvalId,
  });

  if (
    parent.status !== "complete" ||
    !parent.validation ||
    parent.maintenance
  ) {
    throw new Error("Maintenance requires a completed measurement validation");
  }

  const suiteId = maintenanceIdentity({
    parentId: parent.evalId,
    kind: "suite",
  });
  const manifestPath = maintenanceManifestPath({
    paths: options.paths,
    suiteId,
  });
  const lock = await acquireLocalLock(
    path.join(options.paths.shadowcloneDirectory, "profile-write.db"),
  );

  if (!lock) {
    throw new Error("Another profile update is running");
  }

  try {
    if (await Bun.file(manifestPath).exists()) {
      const manifest = await readMaintenanceManifest({
        paths: options.paths,
        suiteId,
      });
      const suite = await readGuidanceSuite({ paths: options.paths, suiteId });

      validateMaintenanceDelta({ parent: parent.suite, suite, manifest });
      await verifyMaintenanceRevision({ paths: options.paths, manifest });

      await verifyMaintainedReference({ paths: options.paths, manifest });

      return { suiteId, manifest };
    }

    if (
      fingerprint(
        await readGuidanceSuite({
          paths: options.paths,
          suiteId: parent.suite.suiteId,
        }),
      ) !== parent.suiteFingerprint
    ) {
      throw new Error("Original frozen suite changed");
    }

    const source = parent.suite.references.find(
      (file) => file.relativePath === referencePath,
    );
    const record = source && parseReference(source.content);

    if (!source || !record) {
      throw new Error("Frozen managed reference is missing");
    }

    const relativePath = referenceRelativePath(record);
    const filePath = path.join(options.paths.profileDirectory, relativePath);

    if (
      fingerprint(await readLocalText(filePath)) !== fingerprint(source.content)
    ) {
      throw new Error(
        "Managed reference fingerprint mismatch; preserve concurrent edits",
      );
    }

    const files = await command({
      cwd: parent.suite.repository,
      arguments: [
        "git",
        "ls-tree",
        "-r",
        "--name-only",
        parent.suite.baseCommit,
        "--",
        incorrectPath,
        correctedPath,
      ],
    });

    if (files.trim() !== correctedPath) {
      throw new Error(
        "Frozen repository does not verify the exact path correction",
      );
    }

    const updatedAt = new Date().toISOString();
    const suite = deriveMaintenanceSuite({
      parent: parent.suite,
      parentEvalId: parent.evalId,
      updatedAt,
    });
    const corrected = suite.references.find(
      (file) => file.relativePath === referencePath,
    );

    if (!corrected) {
      throw new Error("Corrected reference missing");
    }

    const revisionId = await commitLocalChanges({
      paths: options.paths,
      root: options.paths.profileDirectory,
      kind: "profile",
      updates: [
        { filePath, previous: source.content, next: corrected.content },
      ],
    });

    if (!revisionId) {
      throw new Error("Maintenance revision was not written");
    }

    const manifest = maintenanceManifestSchema.parse({
      version: 1,
      parentEvalId: parent.evalId,
      parentSuiteFingerprint: parent.suiteFingerprint,
      suiteFingerprint: fingerprint(suite),
      delta: {
        path: referencePath,
        relativePath,
        beforeHash: fingerprint(source.content),
        afterHash: fingerprint(corrected.content),
        updatedAt,
        revisionId,
        verifiedCommit: parent.suite.baseCommit,
        verifiedPath: correctedPath,
      },
    });

    await saveGuidanceSuite({ paths: options.paths, suite });
    await ownedWrite({
      path: manifestPath,
      content: JSON.stringify(manifest, null, 2),
    });

    return { suiteId, manifest };
  } finally {
    lock.release();
  }
}
