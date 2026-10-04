import type { SkillRule } from "./quality";

export const pendingSkillNames: ReadonlySet<string> = new Set([
  "design-deep-modules",
  "diagnose-before-editing",
  "research-primary-sources",
  "resolve-conflicts-by-intent",
  "shadowclone-work",
  "typescript-type-safety",
]);

export const permanentRuleExemptions: ReadonlyMap<string, readonly SkillRule[]> = new Map([
  ["shadowclone-work", ["gates", "example"]],
]);
