import { missingEnvironmentMessage, readEnvironment } from "@shadowclone/environment";
import type { ProjectPaths } from "@shadowclone/core";
import { canonicalPath } from "@shadowclone/core";
import { parseProfileRejectionText, profileRulePath } from "@shadowclone/profile";
import type { GeneratedProfileStateEntry } from "@shadowclone/profile";

export async function guidanceImportState(paths: ProjectPaths) {
  const state = await readEnvironment(paths);

  if (state === null) {
    throw new Error(missingEnvironmentMessage);
  }

  const previous: readonly GeneratedProfileStateEntry[] = state.records.map(({ rule }) => ({
    relativePath: profileRulePath(rule),
    key: rule.key,
    title: rule.title,
    body: rule.body,
    source: rule.source,
    importReference: rule.importReference,
    disposition: rule.status === "stale" ? "retired" : "present",
  }));

  return {
    previous,
    rejections: parseProfileRejectionText(state.rejectionText),
    owned: new Set(state.artifacts.map(({ filePath }) => canonicalPath(filePath))),
  };
}
