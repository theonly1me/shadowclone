import {
  fingerprint,
  readLocalText,
  replaceLocalText,
  createProjectPaths,
} from "@shadowclone/core";
import { prepareHookTarget } from "./hookTarget";
import {
  guidanceMarkers,
  markedSection,
  updateManagedSection,
} from "./markdown";
import { integrationFilePath, integrationTargets, retiredIntegrationTargets } from "./targets";
import type { Integration, IntegrationFile } from "./types";
import { renderIntegrationExtension } from "./extensions";
import { readIntegrations } from "./state";
import { importsPeerInstructions } from "./sharedInstructions";
import { PreservedFileError, preservedAt } from "./preserved";
import { renderContextSkill } from "./contextSkill";

export type IntegrationFileChange = {
  readonly filePath: string;
  readonly previous: string | null;
  readonly next: string | null;
  readonly record: IntegrationFile;
  readonly retired?: boolean;
  readonly replacedEdit?: boolean;
};

export function savedRecords(changes: readonly IntegrationFileChange[]): IntegrationFile[] {
  return changes.flatMap((change) => (change.retired ? [] : [change.record]));
}

export async function prepareIntegrationFiles(options: {
  readonly integration: Integration;
  readonly profile: string;
  readonly remove?: boolean;
  readonly peers?: readonly Integration[];
  readonly replaceEdited?: boolean;
}): Promise<readonly IntegrationFileChange[]> {
  const changes: IntegrationFileChange[] = [];
  const integrations = await readIntegrations(createProjectPaths({ homeDirectory: options.integration.userDirectory, platform: process.platform }));

  for (const target of integrationTargets(options.integration)) {
    const filePath = integrationFilePath({
      integration: options.integration,
      file: target,
    });
    const previous = await readLocalText(filePath);
    const shared = integrations.flatMap((integration) => integration.id === options.integration.id ? [] :
      integration.files.filter((file) => integrationFilePath({ integration, file }) === filePath));
    const recorded = options.integration.files.find(
      (file) => file.relativePath === target.relativePath,
    ) ?? shared[0];

    if (options.remove && shared.length > 0) continue;

    if (options.remove && (!recorded || previous === null)) {
      continue;
    }

    let next: string | null;
    let digest: string;
    let replacedEdit = false;

    if (target.kind === "hooks") {
      ({ next, digest, replacedEdit } = prepareHookTarget({
        filePath,
        previous,
        recorded,
        integration: options.integration,
        remove: options.remove,
        replaceEdited: options.replaceEdited,
      }));
    } else if (target.kind === "skill" || target.kind === "extension") {
      const editedFile =
        previous !== null &&
        (!recorded || (fingerprint(previous) !== recorded.fingerprint &&
          !shared.some(file => file.kind === target.kind && file.fingerprint === fingerprint(previous))));

      if (editedFile && !options.replaceEdited) {
        throw new PreservedFileError({ reason: "editedIntegrationFile", filePath });
      }

      replacedEdit = editedFile;

      next = options.remove
        ? null
        : target.kind === "extension" ? renderIntegrationExtension(options.integration)
        : `${renderContextSkill()}\n`;
      digest = fingerprint(next ?? "");
    } else {
      const prefix =
        previous === null && options.integration.agent === "cursor"
          ? "---\ndescription: Personal engineering preferences from shadowclone\nalwaysApply: true\n---\n"
          : previous;
      const importsPeer = importsPeerInstructions({
        integration: options.integration,
        filePath,
        text: previous,
        peers: options.peers ?? integrations,
      });
      const changed = preservedAt({
        filePath,
        prepare: () =>
          updateManagedSection({
            previous: prefix,
            body: options.remove || importsPeer ? null : options.profile,
            expected: recorded?.fingerprint,
            replaceEdited: options.replaceEdited,
          }),
      });

      next = changed.text;
      digest = changed.fingerprint;
      replacedEdit = changed.replacedEdit;

      const empty =
        next.trim() === "" ||
        next ===
          "---\ndescription: Personal engineering preferences from shadowclone\nalwaysApply: true\n---\n";

      if (options.remove && recorded?.created && empty) {
        next = null;
      }
    }

    changes.push({
      filePath,
      previous,
      next,
      record: {
        ...target,
        fingerprint: digest,
        created: recorded?.created ?? previous === null,
      },
      ...(replacedEdit ? { replacedEdit } : {}),
    });
  }

  for (const target of retiredIntegrationTargets(options.integration)) {
    const recorded = options.integration.files.find(
      (file) => file.relativePath === target.relativePath && file.kind === target.kind,
    );
    const filePath = integrationFilePath({ integration: options.integration, file: target });
    const previous = recorded ? await readLocalText(filePath) : null;

    if (
      !recorded ||
      previous === null ||
      markedSection({ text: previous, markers: guidanceMarkers }) === null
    ) {
      continue;
    }

    const changed = preservedAt({
      filePath,
      prepare: () => updateManagedSection({ previous, body: null, expected: recorded.fingerprint }),
    });

    changes.push({
      filePath,
      previous,
      next: recorded.created && changed.text.trim() === "" ? null : changed.text,
      record: { ...target, fingerprint: changed.fingerprint, created: recorded.created },
      retired: true,
    });
  }

  return changes;
}

export async function applyIntegrationFiles(
  changes: readonly IntegrationFileChange[],
): Promise<void> {
  const completed: IntegrationFileChange[] = [];

  try {
    for (const change of changes) {
      await replaceLocalText(change);
      completed.push(change);
    }
  } catch (error) {
    for (const change of completed.reverse()) {
      await replaceLocalText({
        filePath: change.filePath,
        previous: change.next,
        next: change.previous,
      });
    }

    throw error;
  }
}
