import type { ProfileRule } from "./types";

export function profileFingerprint(value: string): string {
  return new Bun.CryptoHasher("sha256")
    .update(value)
    .digest("hex")
    .slice(0, 16);
}

export function profileRulePath(rule: ProfileRule): string {
  return rule.scope === "global"
    ? `global/${rule.section}.md`
    : `org/${rule.originDirectory ?? "isolated"}/${rule.section}.md`;
}

export function renderProfileRule(rule: ProfileRule): string {
  const visible = `## ${rule.title}\n\n${rule.body}`;
  const metadata = [
    `key=${rule.key}`,
    `observations=${rule.observations}`,
    `confidence=${rule.confidence.toFixed(2)}`,
    `last-seen=${rule.lastSeen}`,
    `sessions=${rule.sessions}`,
    `origins=${rule.origins.join(",")}`,
    `scope=${rule.scope}`,
    `fingerprint=${profileFingerprint(visible)}`,
  ].join(" ");
  return `${visible}\n\n<!-- shadowclone: ${metadata} -->`;
}
