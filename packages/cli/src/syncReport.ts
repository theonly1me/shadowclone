import type { PreservedReason, ReplacedRouting, SkippedRouting } from "@shadowclone/environment";

const preservedReasons: Readonly<Record<PreservedReason, string>> = {
  editedManagedContent: "its shadowclone section changed after shadowclone wrote it",
  untrackedManagedContent: "it has a shadowclone section that shadowclone has no record of",
  invalidHookConfiguration: "its hook configuration is not valid JSON",
  editedHooks: "its shadowclone hooks changed after shadowclone wrote them",
  editedIntegrationFile: "it changed after shadowclone wrote it",
};

function skippedLine(entry: SkippedRouting): string {
  if (entry.kind === "link") {
    return `Did not update ${entry.agent}: ${entry.path} is ${entry.target === null ? "not a regular file" : `a symbolic link to ${entry.target}`}. shadowclone does not write through links, so ${entry.agent} keeps its old routing. Replace the link with a regular file, then run shadowclone sync.`;
  }

  const next =
    entry.reason === "invalidHookConfiguration"
      ? "Fix the JSON, then run shadowclone sync."
      : "To replace the shadowclone content in it, run shadowclone sync --replace-edited.";

  return `Did not update ${entry.agent}: shadowclone kept ${entry.path}, because ${preservedReasons[entry.reason]}. ${entry.agent} keeps its old routing. ${next}`;
}

export function syncReportLines(options: {
  readonly removed: readonly string[];
  readonly replaced: readonly ReplacedRouting[];
  readonly skipped: readonly SkippedRouting[];
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
    skippedAgents.length === 0
      ? "Synchronized learned skills and native routing."
      : `Synchronized learned skills and native routing for every agent except ${skippedAgents.join(", ")}.`,
  ];
}
