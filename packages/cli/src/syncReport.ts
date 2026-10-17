import {
  type MissingBuildSkill,
  preservedFileReasons,
  type ReplacedRouting,
  type SkippedRouting,
} from "@shadowclone/environment";

function skippedLine(entry: SkippedRouting): string {
  if (entry.kind === "link") {
    return `Did not update ${entry.agent}: ${entry.path} is ${entry.target === null ? "not a regular file" : `a symbolic link to ${entry.target}`}. shadowclone does not write through links, so ${entry.agent} keeps its old routing. Replace the link with a regular file, then run shadowclone sync.`;
  }

  const next =
    entry.reason === "invalidHookConfiguration"
      ? "Fix the JSON, then run shadowclone sync."
      : "To replace the shadowclone content in it, run shadowclone sync --replace-edited.";

  return `Did not update ${entry.agent}: shadowclone kept ${entry.path}, because ${preservedFileReasons[entry.reason]}. ${entry.agent} keeps its old routing. ${next}`;
}

function missingLine(skill: MissingBuildSkill): string {
  return `Did not route ${skill.name}: every copy of the skill is missing (${skill.filePaths.join(", ")}). The build still selects it. Restore a copy, or remove the skill from the build in shadowclone wizard.`;
}

function summaryLine(options: {
  readonly skippedAgents: readonly string[];
  readonly missing: readonly MissingBuildSkill[];
}): string {
  const synchronized =
    options.skippedAgents.length === 0
      ? "Synchronized learned skills and native routing."
      : `Synchronized learned skills and native routing for every agent except ${options.skippedAgents.join(", ")}.`;
  const count = options.missing.length;

  return count === 0 ? synchronized : `${synchronized} Did not route ${count} missing build ${count === 1 ? "skill" : "skills"}.`;
}

export function syncReportLines(options: {
  readonly removed: readonly string[];
  readonly replaced: readonly ReplacedRouting[];
  readonly skipped: readonly SkippedRouting[];
  readonly missing: readonly MissingBuildSkill[];
}): readonly string[] {
  const skippedAgents = [...new Set(options.skipped.map((entry) => entry.agent))];

  return [
    ...options.removed.map(
      (directory) => `Removed the registered repository ${directory}, because the folder no longer exists.`,
    ),
    ...options.replaced.map(
      (entry) =>
        `Replaced the edited shadowclone content in ${entry.path} for ${entry.agent}. shadowclone history lists the revision that restores it.`,
    ),
    ...options.skipped.map(skippedLine),
    ...options.missing.map(missingLine),
    summaryLine({ skippedAgents, missing: options.missing }),
  ];
}
