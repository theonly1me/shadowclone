import { z } from "zod";
import { fingerprint } from "../localFiles";
import type { Integration } from "./types";

const documentSchema = z.object({ hooks: z.record(z.string(), z.array(z.unknown())).default({}) }).passthrough();

function parseDocument(text: string | null) {
  try {
    return documentSchema.parse(text === null ? {} : JSON.parse(text));
  } catch {
    throw new Error("Invalid native hook configuration; preserving the file");
  }
}

export function ownedHooks(integration: Integration): Readonly<Record<string, readonly unknown[]>> {
  const command = `shadowclone hook native-start ${integration.id}`;
  const endCommand = `shadowclone hook native-end ${integration.id}`;
  if (integration.agent === "antigravity") {
    return {
      PreInvocation: [{
        matcher: "*",
        hooks: [{ type: "command", command, timeout: 10 }],
      }],
      Stop: [{ hooks: [{ type: "command", command: endCommand, timeout: 3 }] }],
    };
  }
  return integration.agent === "cursor"
    ? { sessionStart: [{ command }], sessionEnd: [{ command: endCommand }] }
    : {
        SessionStart: [{ hooks: [{ type: "command", command, timeout: 10, ...(integration.agent === "codex" ? { additionalContextLimit: 6000 } : {}) }] }],
        ...(integration.agent === "claude-code" ? { SubagentStart: [{ hooks: [{ type: "command", command, timeout: 10 }] }] } : {}),
        SessionEnd: [{ hooks: [{ type: "command", command: endCommand, timeout: 3 }] }],
      };
}

export function updateHookConfig(options: {
  readonly previous: string | null;
  readonly integration: Integration;
  readonly remove?: boolean;
}): { readonly text: string; readonly fingerprint: string } {
  const parsed = parseDocument(options.previous);
  const hooks = { ...parsed.hooks };
  const owned = ownedHooks(options.integration);
  for (const [event, entries] of Object.entries(owned)) {
    const identities = entries.map((entry) => JSON.stringify(entry));
    const retained = (hooks[event] ?? []).filter((entry) => !identities.includes(JSON.stringify(entry)));
    const next = options.remove ? retained : [...retained, ...entries];
    if (next.length === 0) delete hooks[event];
    else hooks[event] = next;
  }
  return {
    text: `${JSON.stringify({ ...(options.integration.agent === "cursor" ? { version: 1 } : {}), ...parsed, hooks }, null, 2)}\n`,
    fingerprint: fingerprint(JSON.stringify(owned)),
  };
}

export function hasOwnedHooks(options: { readonly text: string; readonly integration: Integration }): boolean {
  const document = parseDocument(options.text);
  return Object.entries(ownedHooks(options.integration)).every(([event, entries]) =>
    entries.every((entry) => (document.hooks[event] ?? []).some((installed) => JSON.stringify(installed) === JSON.stringify(entry))),
  );
}

export function emptyHookConfig(text: string): boolean {
  const document = parseDocument(text);
  return Object.keys(document.hooks).length === 0 && Object.keys(document).every((key) => key === "hooks" || key === "version");
}
