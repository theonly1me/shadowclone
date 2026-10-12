import type { ProfileRule } from "@shadowclone/profile";
import { seedGuidanceProfileKey } from "@shadowclone/skills";
import type { SeedGuidance } from "@shadowclone/skills";

function profileBodyFromSeedGuidance(guidance: SeedGuidance): string {
  return guidance.kind === "skill"
    ? guidance.body.replace(/^## /gm, "### ")
    : guidance.body;
}

export function profileRuleFromSeedGuidance(
  guidance: SeedGuidance,
): ProfileRule {
  return {
    key: seedGuidanceProfileKey(guidance.id),
    title: guidance.title,
    body: profileBodyFromSeedGuidance(guidance),
    section: guidance.section,
    scope: "global",
    originDirectory: null,
    repositoryName: null,
    source: "declared",
    status: "active",
    proposal: null,
    appliesWhen: guidance.appliesWhen,
    evidence: { for: [], against: [] },
    observations: 0,
    lastSeen: "declared",
    sessions: 0,
    origins: [],
    importReference: null,
  };
}
