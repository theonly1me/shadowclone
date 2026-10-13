import type { EnvironmentState } from "./types";

export function repositoryDeliveryQuestion(options: {
  readonly state: EnvironmentState;
  readonly originDirectory: string | null;
  readonly repositoryName: string | null;
}): string {
  const { originDirectory, repositoryName } = options;

  if (originDirectory === null || repositoryName === null || options.state.repositories.some((repository) =>
    repository.originDirectory === originDirectory && repository.repositoryName === repositoryName,
  )) {
    return "";
  }

  const waiting = options.state.records.filter(({ rule, retirementRequested }) =>
    rule.status === "active" && rule.proposal === null && rule.source !== "imported" && !retirementRequested &&
    rule.scope !== "global" && rule.originDirectory === originDirectory &&
    (rule.scope === "org" || rule.repositoryName === repositoryName),
  ).length;

  return waiting === 0 ? "" : [
    `shadowclone has ${waiting} learned rule(s) for this repository that wait for a destination.`,
    "Ask the user once whether to keep them private or to publish them into this repository's skill folders.",
    "Then run `shadowclone learning repositories set . --private` or `shadowclone learning repositories set . --repository` from the repository root.",
    "Do not change repository files before the user answers.",
  ].join(" ");
}
