import path from "node:path";
import { canonicalPath } from "@shadowclone/core";
import type { SkillRoot } from "./types";

function isClaudeSyncedSkill(options: {
  readonly root: SkillRoot;
  readonly segments: readonly string[];
}): boolean {
  return (
    options.root.scope === "global" &&
    options.segments[0] === "synced" &&
    options.root.directory === canonicalPath(path.join(options.root.cwd, ".claude", "skills"))
  );
}

export function isSkippedSkill(options: {
  readonly root: SkillRoot;
  readonly relativePath: string;
  readonly includeCompanions: boolean;
}): boolean {
  const segments = options.relativePath.split(path.sep);

  return (
    isClaudeSyncedSkill({ root: options.root, segments }) ||
    segments.some(
      (segment) =>
        segment === "shadowclone-context" ||
        (!options.includeCompanions && segment.startsWith("shadowclone-local-")),
    )
  );
}
