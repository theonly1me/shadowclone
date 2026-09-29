import path from "node:path";
import type {
  EnvironmentArtifact,
  EnvironmentState,
} from "../environment/types";

export function renderBuildRouting(options: {
  readonly state: EnvironmentState;
  readonly cwd?: string;
  readonly sharedOnly?: boolean;
  readonly includeGlobal?: boolean;
}): string {
  const builds = options.state.builds.filter((build) =>
    options.sharedOnly
      ? build.scope === "shared" && build.directory === options.cwd
      : (build.scope === "global" && options.includeGlobal !== false) ||
        (options.cwd !== undefined &&
          (options.cwd === build.directory ||
            options.cwd.startsWith(`${build.directory}${path.sep}`))),
  );

  if (builds.length === 0) {
    return "";
  }

  builds.sort(
    (left, right) =>
      Number(left.scope !== "global") - Number(right.scope !== "global") ||
      left.directory.length - right.directory.length,
  );

  const choices: Record<string, boolean> = {};

  for (const build of builds) {
    if (build.scope !== "shared") {
      Object.assign(choices, build.choices);
    }
  }

  const artifacts = new Map<string, EnvironmentArtifact>();

  for (const build of builds) {
    for (const artifact of options.state.artifacts) {
      if (artifact.kind !== "skill" || artifact.buildId !== build.id) {
        continue;
      }

      const enabled =
        build.scope === "shared"
          ? build.choices[artifact.buildEntryId ?? ""]
          : choices[artifact.buildEntryId ?? ""];

      if (
        enabled === false ||
        (!enabled && artifact.buildEntryId !== "build-preferences")
      ) {
        continue;
      }

      const key =
        build.scope === "shared"
          ? `${build.id}:${artifact.name}`
          : artifact.name;
      const previous = artifacts.get(key);

      if (
        !previous ||
        previous.buildId !== build.id ||
        artifact.filePath.includes("/.agents/skills/")
      ) {
        artifacts.set(key, artifact);
      }
    }
  }

  const lines = [
    "## Your agent build",
    "",
    "Follow repository requirements. Repository build choices override personal global choices. Load the selected workflow skills when their descriptions match the task. When a selected workflow skill conflicts with the user's own skills or learned baseline rules, follow the user's guidance.",
  ];

  for (const artifact of artifacts.values()) {
    const location =
      options.sharedOnly && options.cwd
        ? path
            .relative(options.cwd, artifact.filePath)
            .split(path.sep)
            .join("/")
        : artifact.filePath;

    lines.push(
      artifact.buildEntryId === "build-preferences"
        ? `Before acting, read the selected working preferences at ${location}.`
        : `- ${artifact.description} Read ${location}.`,
    );
  }

  const text = `${lines.join("\n")}\n`;

  if (Buffer.byteLength(text) > 4096) {
    throw new Error(
      "Build routing exceeds 4 KiB; shorten skill descriptions or equip fewer skills",
    );
  }

  return text;
}
