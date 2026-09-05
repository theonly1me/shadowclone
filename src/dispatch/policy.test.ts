import { expect, test } from "bun:test";
import { normalizeRemoteRepository } from "../signal";
import { resolveDispatchPolicy } from "./index";

const configuredPolicy = {
  allow: ["push", "pr-draft"] as const,
  maxBudgetUsd: 3,
  requireCleanExit: true,
};

test("normalizes a remote without storing credentials", () => {
  expect(
    normalizeRemoteRepository(
      "https://private-token@github.com/Acme/Platform.git",
    ),
  ).toEqual({
    id: "github.com/acme/platform",
    origin: {
      id: "github.com/acme",
      directoryName: "github.com--acme",
      promotable: true,
    },
  });
});

test("an empty repo allowlist removes every remote action", () => {
  const policy = resolveDispatchPolicy({
    configuredPolicy: null,
    approvedActions: [],
    managedActionTier: "act",
  });

  expect(policy.allowedTools).not.toContain("Bash(git push:*)");
  expect(policy.disallowedTools).toContain("Bash(git push:*)");
  expect(policy.blockedActions).toContain("push");
  expect(policy.blockedActions).toContain("merge");
  expect(policy.blockedActions).toContain("force-push");
});

test("repo policy and per-run approval are both required", () => {
  const withoutApproval = resolveDispatchPolicy({
    configuredPolicy,
    approvedActions: [],
    managedActionTier: "act",
  });
  const approved = resolveDispatchPolicy({
    configuredPolicy,
    approvedActions: ["push"],
    managedActionTier: "act",
  });

  expect(withoutApproval.allowedTools).not.toContain("Bash(git push:*)");
  expect(approved.allowedTools).toContain("Bash(git push:*)");
  expect(approved.grantedActions).toEqual(["push"]);
  expect(approved.maxBudgetUsd).toBe(3);
});

test("managed draft tier overrides repo and run approval", () => {
  const policy = resolveDispatchPolicy({
    configuredPolicy,
    approvedActions: ["push", "pr-draft"],
    managedActionTier: "draft",
  });

  expect(policy.grantedActions).toEqual([]);
  expect(policy.disallowedTools).toContain("Bash(git push:*)");
  expect(policy.disallowedTools).toContain("Bash(gh pr create --draft:*)");
});
