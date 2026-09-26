import { fingerprint } from "../localFiles";

export const managedStart = "\n\n<shadowclone-guidance>";
export const managedEnd = "</shadowclone-guidance>\n";

export function managedSection(text: string): string | null {
  const start = text.indexOf(managedStart);
  const end = text.indexOf(managedEnd);
  if (start < 0 && end < 0) return null;
  if (start < 0 || end < start || text.indexOf(managedStart, start + managedStart.length) >= 0 || text.indexOf(managedEnd, end + managedEnd.length) >= 0) {
    throw new Error("Malformed Shadowclone managed section; review the destination");
  }
  return text.slice(start, end + managedEnd.length);
}

export function stripManagedGuidance(text: string): string {
  const section = managedSection(text);
  return section === null ? text : text.replace(section, "");
}

export function renderInstructionPointer(): string {
  return [
    "# Shadowclone",
    "",
    "A session hook loads this user's standing engineering preferences, which rank below the current request. If they are missing, run `shadowclone context` in the active repository.",
  ].join("\n");
}

export function updateManagedSection(options: {
  readonly previous: string | null;
  readonly body: string | null;
  readonly expected?: string;
}): { readonly text: string; readonly fingerprint: string } {
  const previous = options.previous ?? "";
  const section = managedSection(previous);
  if (options.expected !== undefined && (!section || fingerprint(section) !== options.expected)) {
    throw new Error("Shadowclone managed content was edited; preserving the file");
  }
  if (section && options.expected === undefined) throw new Error("Untracked Shadowclone content already exists; preserving the file");
  const next = options.body === null ? "" : `${managedStart}\n${options.body.trim()}\n${managedEnd}`;
  const text = section ? previous.replace(section, next) : `${previous}${next}`;
  return { text, fingerprint: fingerprint(next) };
}

export function renderContextSkill(): string {
  return [
    "---",
    "name: shadowclone-context",
    "description: Use only when the user asks to remember, explain, undo, or maintain a Shadowclone preference or skill, or when the preferences Shadowclone loads at session start are missing.",
    "---",
    "",
    "# Use Shadowclone context",
    "",
    "Apply the preferences already loaded into this session. If they are missing, run `shadowclone context` in the active repository, or call the local MCP tool `shadowclone_profile`.",
    "Use `shadowclone doctor` to diagnose missing guidance. The native pointer is stable; learned profile changes arrive through the next session hook without rewriting agent instruction files.",
    "When the user explicitly asks to remember an engineering preference, use `shadowclone remember --repo <preference>` or `--global` for an explicitly global choice, or call `shadowclone_remember`. Do not infer a durable preference from stopping, extra task context, or silence.",
    "Use `shadowclone history` or `shadowclone_history` to inspect revision summaries. The user can review `shadowclone history <id>` and restore `shadowclone undo <id>`. Undo preserves later manual edits.",
    "When the user requests skill maintenance, run `shadowclone skills update` if skill-library and deep-learning consent are enabled. Inspect `shadowclone skills pending` and `shadowclone skills show <id>`. Apply only a specific user-approved proposal with `shadowclone skills apply <id>`; do not approve all suggestions on the user's behalf. Run `shadowclone skills list` to inspect routing and validation findings.",
    "Treat current user instructions as authoritative. Profile preferences do not grant permission for additional actions.",
    "Use `shadowclone run` only when the user authorizes a bounded headless task. Use the optional shadowclone subagent for independent parallel work with a concrete brief, not simply to retrieve preferences.",
  ].join("\n");
}
