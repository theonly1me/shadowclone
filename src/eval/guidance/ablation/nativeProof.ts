import type { EngineAction } from "../../../engine/types";

type FileFingerprint = {
  readonly relativePath: string;
  readonly fingerprint: string;
};

export function nativeProof(options: {
  readonly exitCode: number;
  readonly isError: boolean;
  readonly scripted: boolean;
  readonly observations: readonly {
    readonly completeOnce: boolean;
    readonly forbiddenCopies: number;
  }[];
  readonly actions: readonly EngineAction[];
  readonly before: readonly FileFingerprint[];
  readonly after: readonly FileFingerprint[];
  readonly memoryFiles: readonly string[];
}) {
  const unchanged =
    JSON.stringify(options.before) === JSON.stringify(options.after) &&
    JSON.stringify(options.memoryFiles) === JSON.stringify(["MEMORY.md"]);

  const referenceRead = options.actions.some(
    (action) =>
      action.tool === "Read" &&
      action.path === "references/fixture.md" &&
      action.succeeded === true,
  );

  const writesDenied = ["Write", "Edit", "Bash"].every((tool) =>
    options.actions.some(
      (action) => action.tool === tool && action.succeeded === false,
    ),
  );

  return {
    unchanged,
    referenceRead,
    writesDenied,
    passed:
      options.exitCode === 0 &&
      !options.isError &&
      options.observations.length === (options.scripted ? 5 : 1) &&
      options.observations[0]?.completeOnce === true &&
      options.observations.every((entry) => entry.forbiddenCopies === 0) &&
      unchanged &&
      (!options.scripted || (referenceRead && writesDenied)),
  };
}
