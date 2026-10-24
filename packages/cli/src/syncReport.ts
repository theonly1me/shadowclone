import {
  type MissingBuildSkill,
  preservedFileReasons,
  type ReplacedRouting,
  type SkippedRouting,
} from "@shadowclone/environment";

function skippedLine(entry: SkippedRouting): string {
  if (entry.kind === "catalog") {
    const reason =
      entry.reason === "edited"
        ? "it changed after shadowclone wrote it"
        : "shadowclone has no ownership record for it";
    return `Preserved task catalog ${entry.path}, because ${reason}. Other scopes continue to publish. To replace it, run shadowclone sync --replace-edited.`;
  }

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
  readonly preservedCatalogs: number;
}): string {
  const synchronized =
    options.skippedAgents.length === 0
      ? "Synchronized learned skills and native routing."
      : `Synchronized learned skills and native routing for every agent except ${options.skippedAgents.join(", ")}.`;
  const count = options.missing.length;

  return [
    synchronized,
    ...(count > 0
      ? [`Did not route ${count} missing build ${count === 1 ? "skill" : "skills"}.`]
      : []),
    ...(options.preservedCatalogs > 0
      ? [
          `Preserved ${options.preservedCatalogs} task ${options.preservedCatalogs === 1 ? "catalog" : "catalogs"}.`,
        ]
      : []),
  ].join(" ");
}

export function syncReportLines(options: {
  readonly removed: readonly string[];
  readonly replaced: readonly ReplacedRouting[];
  readonly skipped: readonly SkippedRouting[];
  readonly missing: readonly MissingBuildSkill[];
}): readonly string[] {
  const skippedAgents = [
    ...new Set(options.skipped.flatMap((entry) => (entry.kind === "catalog" ? [] : [entry.agent]))),
  ];
  const preservedCatalogs = options.skipped.filter((entry) => entry.kind === "catalog").length;

  return [
    ...options.removed.map(
      (directory) =>
        `Removed the registered repository ${directory}, because the folder no longer exists.`,
    ),
    ...options.replaced.map((entry) =>
      entry.agent === null
        ? `Replaced task catalog ${entry.path}. shadowclone history lists the revision that restores it.`
        : `Replaced the edited shadowclone content in ${entry.path} for ${entry.agent}. shadowclone history lists the revision that restores it.`,
    ),
    ...options.skipped.map(skippedLine),
    ...options.missing.map(missingLine),
    summaryLine({ skippedAgents, missing: options.missing, preservedCatalogs }),
  ];
}
