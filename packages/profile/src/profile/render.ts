import type { ProfileRule } from "./types";

export function createProfileRuleKey(): string {
  return crypto.randomUUID();
}

export function profileRulePath(rule: ProfileRule): string {
  if (rule.scope === "global") {
    return `global/${rule.section}.md`;
  }

  if (!isSafeProfileSegment(rule.originDirectory)) {
    throw new Error("Profile rule has an invalid origin directory");
  }

  if (rule.scope === "project") {
    if (!isSafeProfileSegment(rule.repositoryName)) {
      throw new Error("Profile rule has an invalid repository name");
    }

    return `org/${rule.originDirectory}/projects/${rule.repositoryName}.md`;
  }

  return `org/${rule.originDirectory}/${rule.section}.md`;
}

function isSafeProfileSegment(value: string): boolean {
  return (
    value.length > 0 &&
    value !== "." &&
    value !== ".." &&
    !value.includes("/") &&
    !value.includes("\\")
  );
}
