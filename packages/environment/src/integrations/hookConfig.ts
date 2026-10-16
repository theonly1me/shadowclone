import { z } from "zod";
import { fingerprint } from "@shadowclone/core";
import type { Integration } from "./types";
import { PreservedFileError } from "./preserved";

const documentSchema = z
  .object({ hooks: z.record(z.string(), z.array(z.unknown())).default({}) })
  .passthrough();

const keyOrderSchema = z.record(z.string(), z.unknown());

function withSortedKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(withSortedKeys);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([key, nested]) => [key, withSortedKeys(nested)]),
    );
  }

  return value;
}

const hookIdentity = (entry: unknown): string => JSON.stringify(withSortedKeys(entry));

function parseDocument(text: string | null) {
  try {
    return documentSchema.parse(text === null ? {} : JSON.parse(text));
  } catch {
    throw new PreservedFileError({ reason: "invalidHookConfiguration" });
  }
}

function hookEntries(options: {
  readonly integration: Integration;
  readonly launcher: string;
  readonly subagent: boolean;
}): Readonly<Record<string, readonly unknown[]>> {
  const { integration } = options;
  const command = `${options.launcher} hook native-start ${integration.id}`;
  const endCommand = `${options.launcher} hook native-end ${integration.id}`;

  if (integration.agent === "pi" || integration.agent === "opencode") {
    throw new Error(`${integration.agent} has no hook configuration file`);
  }

  if (integration.agent === "antigravity") {
    return {
      PreInvocation: [
        {
          matcher: "*",
          hooks: [{ type: "command", command, timeout: 10 }],
        },
      ],
      Stop: [{ hooks: [{ type: "command", command: endCommand, timeout: 3 }] }],
    };
  }

  integration.agent satisfies "cursor" | "claude-code" | "codex";

  return integration.agent === "cursor"
    ? { sessionStart: [{ command }], sessionEnd: [{ command: endCommand }] }
    : {
        SessionStart: [
          {
            hooks: [
              {
                type: "command",
                command,
                timeout: 10,
                ...(integration.agent === "codex"
                  ? { additionalContextLimit: 6000 }
                  : {}),
              },
            ],
          },
        ],
        ...(integration.agent === "claude-code" && options.subagent
          ? {
              SubagentStart: [
                { hooks: [{ type: "command", command, timeout: 10 }] },
              ],
            }
          : {}),
        SessionEnd: [
          { hooks: [{ type: "command", command: endCommand, timeout: 3 }] },
        ],
      };
}

export function ownedHooks(integration: Integration): Readonly<Record<string, readonly unknown[]>> {
  return hookEntries({
    integration,
    launcher: integration.agent === "claude-code" || integration.agent === "codex"
      ? 'sh "$HOME/.shadowclone/bin/shadowclone"'
      : "shadowclone",
    subagent: false,
  });
}

function legacyHooks(integration: Integration): Readonly<Record<string, readonly unknown[]>> {
  return hookEntries({ integration, launcher: "shadowclone", subagent: true });
}

export function updateHookConfig(options: {
  readonly previous: string | null;
  readonly integration: Integration;
  readonly remove?: boolean;
}): { readonly text: string; readonly fingerprint: string } {
  const parsed = parseDocument(options.previous);
  const original = keyOrderSchema.parse(options.previous === null ? {} : JSON.parse(options.previous));
  const hooks = { ...parsed.hooks };
  const owned = ownedHooks(options.integration);
  const legacy = legacyHooks(options.integration);

  for (const event of new Set([...Object.keys(owned), ...Object.keys(legacy)])) {
    const entries = owned[event] ?? [];
    const identities = [...entries, ...(legacy[event] ?? [])].map(hookIdentity);
    const retained = (hooks[event] ?? []).filter(
      (entry) => !identities.includes(hookIdentity(entry)),
    );
    const next = options.remove ? retained : [...retained, ...entries];

    if (next.length === 0) {
      delete hooks[event];
    } else {
      hooks[event] = next;
    }
  }

  return {
    text: `${JSON.stringify({ ...(options.integration.agent === "cursor" ? { version: 1 } : {}), ...original, hooks }, null, 2)}\n`,
    fingerprint: fingerprint(JSON.stringify(owned)),
  };
}

export function hasOwnedHooks(options: {
  readonly text: string;
  readonly integration: Integration;
}): boolean {
  const document = parseDocument(options.text);

  const matches = (entries: Readonly<Record<string, readonly unknown[]>>) =>
    Object.entries(entries).every(([event, eventEntries]) =>
      eventEntries.every((entry) =>
        (document.hooks[event] ?? []).some((installed) =>
          hookIdentity(installed) === hookIdentity(entry)
        )
      )
    );

  return matches(ownedHooks(options.integration)) || matches(legacyHooks(options.integration));
}

export function emptyHookConfig(text: string): boolean {
  const document = parseDocument(text);

  return (
    Object.keys(document.hooks).length === 0 &&
    Object.keys(document).every((key) => key === "hooks" || key === "version")
  );
}
