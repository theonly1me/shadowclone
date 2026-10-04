import type { SkillRule } from "./quality";

export const pendingSkillNames: ReadonlySet<string> = new Set([
  "design-deep-modules",
  "diagnose-before-editing",
  "research-primary-sources",
  "resolve-conflicts-by-intent",
  "scope-confirmed-changes",
  "shadowclone-work",
  "typescript-type-safety",
  "verify-and-review",
]);

export const permanentRuleExemptions: ReadonlyMap<string, readonly SkillRule[]> = new Map([
  ["shadowclone-work", ["gates", "example"]],
]);
