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
    requireCleanExit: true,
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
  const allowedTools = [
    ...draftTools,
    ...grantedActions.flatMap((action) => {
      const tool = actionToolFor(action);
      return tool ? [tool] : [];
    }),
  ];
  const disallowedTools = [
    ...actionCapabilities
      .filter((action) => !grantedActions.includes(action))
      .flatMap((action) => {
        const tool = actionToolFor(action);
        return tool ? [tool] : [];
      }),
    ...permanentlyBlockedTools,
  ];
  return {
    allowedTools,
    disallowedTools,
    permissionMode: "dontAsk",
    maxBudgetUsd: configured.maxBudgetUsd,
    requireCleanExit: configured.requireCleanExit,
    grantedActions,
    blockedActions,
  };
}
