export type LearnCommandOptions = {
  readonly deep: boolean;
  readonly dryRun: boolean;
  readonly apply: boolean;
};

export function parseLearnOptions(
  arguments_: readonly string[],
): LearnCommandOptions | null {
  if (!arguments_.every((argument) =>
    argument === "--deep" || argument === "--dry-run" || argument === "--apply"
  )) {
    return null;
  }
  const options = {
    deep: arguments_.includes("--deep"),
    dryRun: arguments_.includes("--dry-run"),
    apply: arguments_.includes("--apply"),
  };
  if (options.apply && !options.deep) {
    throw new Error("learn --apply requires --deep");
  }
  if (options.apply && options.dryRun) {
    throw new Error("learn --apply cannot be combined with --dry-run");
  }
  return options;
}
