import {
  encodeProfileMetadata,
  uniqueProfileEvidence,
} from "./metadata";
import type { ProfileRule } from "./types";

export function profileFingerprint(value: string): string {
  return new Bun.CryptoHasher("sha256")
    .update(value)
    .digest("hex")
    .slice(0, 16);
}

export function createProfileRuleKey(): string {
  return crypto.randomUUID();
}

export function profileRulePath(rule: ProfileRule): string {
  return rule.scope === "global"
    ? `global/${rule.section}.md`
    : `org/${rule.originDirectory ?? "isolated"}/${rule.section}.md`;
}

export function renderProfileRule(rule: ProfileRule): string {
  const visible = `## ${rule.title}\n\n${rule.body}`;
  const evidence = uniqueProfileEvidence(rule.evidence);
  const metadata = {
    schema: 1,
    key: rule.key,
    source: rule.source,
    status: rule.status,
    proposal: rule.proposal,
    "applies-when": [...rule.appliesWhen],
    supports: evidence.for.length,
    contradicts: evidence.against.length,
    evidence,
    observations: rule.observations,
    "last-seen": rule.lastSeen,
    sessions: rule.sessions,
    origins: [...rule.origins],
    scope: rule.scope,
    fingerprint: profileFingerprint(visible),
  };
  return `${visible}\n\n<!-- shadowclone: ${encodeProfileMetadata(metadata)} -->`;
}
