import { emptyHookConfig, hasOwnedHooks, updateHookConfig } from "./hookConfig";
import { PreservedFileError, preservedAt } from "./preserved";
import type { Integration, IntegrationFile } from "./types";

export function prepareHookTarget(options: {
  readonly filePath: string;
  readonly previous: string | null;
  readonly recorded: IntegrationFile | undefined;
  readonly integration: Integration;
  readonly remove?: boolean;
  readonly replaceEdited?: boolean;
}): { readonly next: string | null; readonly digest: string; readonly replacedEdit: boolean } {
  const { filePath, previous, integration } = options;
  const replacedEdit =
    options.recorded !== undefined &&
    previous !== null &&
    !preservedAt({ filePath, prepare: () => hasOwnedHooks({ text: previous, integration }) });

  if (replacedEdit && !options.replaceEdited) {
    throw new PreservedFileError({ reason: "editedHooks", filePath });
  }

  const changed = preservedAt({
    filePath,
    prepare: () => updateHookConfig({ previous, integration, remove: options.remove }),
  });
  const emptied = options.remove && options.recorded?.created && emptyHookConfig(changed.text);

  return { next: emptied ? null : changed.text, digest: changed.fingerprint, replacedEdit };
}
