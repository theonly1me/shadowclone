import { actionCapabilities } from "../config";
import type { DispatchPolicyInput, ResolvedDispatchPolicy } from "./types";

const draftTools = [
  "Read",
  "Grep",
  "Glob",
  "Edit",
  "Write",
  "Bash(git status)",
  "Bash(git diff)",
  "Bash(bun test)",
  "Bash(bun run typecheck)",
];

const actionTools = {
  push: "Bash(git push:*)",
  "pr-draft": "Bash(gh pr create --draft:*)",
  "pr-reply": "Bash(gh pr comment:*)",
} as const;

const permanentlyBlockedTools = [
  "Bash(git add:*)",
  "Bash(git commit:*)",
  "Bash(git push --force:*)",
  "Bash(git push -f:*)",
  "Bash(gh pr merge:*)",
];

export function resolveDispatchPolicy(
  input: DispatchPolicyInput,
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
  const allowedTools = [
    ...draftTools,
    ...grantedActions.map((action) => actionTools[action]),
  ];
  const disallowedTools = [
    ...actionCapabilities
      .filter((action) => !grantedActions.includes(action))
      .map((action) => actionTools[action]),
    ...permanentlyBlockedTools,
  ];
  return {
    allowedTools,
    disallowedTools,
    permissionMode: "acceptEdits",
    maxBudgetUsd: configured.maxBudgetUsd,
    requireCleanExit: configured.requireCleanExit,
    grantedActions,
    blockedActions,
  };
}
