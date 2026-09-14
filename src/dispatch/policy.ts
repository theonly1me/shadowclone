import { actionCapabilities, type ActionCapability } from "../config";
import type { DispatchPolicyInput, ResolvedDispatchPolicy } from "./types";

const baseDraftTools = [
  "Read",
  "Grep",
  "Glob",
  "Edit",
  "Write",
  "Bash(git status:*)",
  "Bash(git diff:*)",
];

const githubDomains = ["github.com", "api.github.com"] as const;

function actionToolFor(action: ActionCapability): string | null {
  if (action === "pr-draft") {
    return "Bash(gh pr create --draft:*)";
  }
  if (action === "pr-reply") {
    return "Bash(gh pr comment:*)";
  }
  return null;
}

const permanentlyBlockedTools = [
  "Bash(git add:*)",
  "Bash(git commit:*)",
  "Bash(git push:*)",
  "Bash(git push --force:*)",
  "Bash(git push -f:*)",
  "Bash(git push --force-with-lease:*)",
  "Bash(gh pr merge:*)",
];

export function resolveDispatchPolicy(
  input: DispatchPolicyInput & {
    readonly verificationTools?: readonly string[];
  },
): ResolvedDispatchPolicy {
  const configured = input.configuredPolicy ?? {
    allow: [],
    maxBudgetUsd: 2,
  };
  const repoAllowed =
    input.managedActionTier === "act" ? configured.allow : [];
  const grantedActions = actionCapabilities.filter(
    (action) =>
      repoAllowed.includes(action) && input.approvedActions.includes(action),
  );
  const blockedActions = [
    ...actionCapabilities.filter((action) => !grantedActions.includes(action)),
    "force-push",
    "merge",
  ] as const;
  const verificationTools = input.verificationTools ?? [
    "Bash(bun test:*)",
    "Bash(bun run typecheck:*)",
  ];
  const draftTools = [...baseDraftTools, ...verificationTools];
  const allowedTools = draftTools;
  const disallowedTools = [
    ...actionCapabilities
      .flatMap((action) => {
        const tool = actionToolFor(action);
        return tool ? [tool] : [];
      }),
    ...permanentlyBlockedTools,
  ];
  const needsNetwork = grantedActions.some(
    (action) => actionToolFor(action) !== null,
  );
  return {
    allowedTools,
    disallowedTools,
    permissionMode: "dontAsk",
    maxBudgetUsd: configured.maxBudgetUsd,
    grantedActions,
    blockedActions,
    allowedDomains: needsNetwork ? [...githubDomains] : [],
  };
}

export function validateRemoteGrants(options: {
  readonly grantedActions: readonly ActionCapability[];
  readonly pullRequestNumber?: number;
}): void {
  if (
    options.grantedActions.includes("pr-reply") &&
    (!Number.isSafeInteger(options.pullRequestNumber) ||
      (options.pullRequestNumber ?? 0) < 1)
  ) {
    throw new Error("PR replies require an explicit --pr number");
  }
  if (
    options.grantedActions.includes("pr-draft") &&
    !options.grantedActions.includes("push")
  ) {
    throw new Error("Draft PR creation also requires push approval");
  }
}
