import { existsSync } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { assertRegularDestination } from "@shadowclone/core";
import type { LiveEngine } from "./record";

const documentSchema = z
  .object({ hooks: z.record(z.string(), z.array(z.unknown())).default({}) })
  .passthrough();

const ownedEntrySchema = z.object({
  hooks: z.array(z.object({ command: z.string() })).min(1),
});

const marker = " live hook ";

const claudeEvents = [
  "SessionStart",
  "UserPromptSubmit",
  "Notification",
  "Stop",
  "StopFailure",
  "SessionEnd",
];

const codexEvents = ["SessionStart", "UserPromptSubmit", "PermissionRequest", "Stop", "SessionEnd"];

export function liveHookEntries(options: {
  readonly engine: LiveEngine;
  readonly launcher: string;
}): Readonly<Record<string, readonly unknown[]>> {
  const command = `${options.launcher}${marker}${options.engine}`;
  const pendingFile = '"$HOME/.shadowclone/live/pending"';
  const events = options.engine === "claude" ? claudeEvents : codexEvents;

  return {
    ...Object.fromEntries(
      events.map((event) => [
        event,
        [{ hooks: [{ type: "command", command, timeout: event === "SessionEnd" ? 3 : 10 }] }],
      ]),
    ),
    PostToolUse: [
      {
        matcher: "*",
        hooks: [
          { type: "command", command: `[ -e ${pendingFile} ] && ${command} || true`, timeout: 10 },
        ],
      },
    ],
  };
}

function owned(entry: unknown): boolean {
  const parsed = ownedEntrySchema.safeParse(entry);

  return parsed.success && parsed.data.hooks.some((hook) => hook.command.includes(marker));
}

export function withLiveHooks(options: {
  readonly text: string | null;
  readonly entries: Readonly<Record<string, readonly unknown[]>>;
  readonly remove: boolean;
}): string {
  let parsedText: unknown;

  try {
    parsedText = options.text === null ? {} : JSON.parse(options.text);
  } catch {
    throw new Error("The hook file is not valid JSON, so shadowclone leaves it unchanged.");
  }

  const document = documentSchema.parse(parsedText);
  const hooks: Record<string, readonly unknown[]> = {};
  const events = new Set([...Object.keys(document.hooks), ...Object.keys(options.entries)]);

  for (const event of events) {
    const kept = (document.hooks[event] ?? []).filter((entry) => !owned(entry));
    const next = options.remove ? kept : [...kept, ...(options.entries[event] ?? [])];

    if (next.length > 0) {
      hooks[event] = next;
    }
  }

  return `${JSON.stringify({ ...document, hooks }, null, 2)}\n`;
}

export type HookTarget = { readonly engine: LiveEngine; readonly file: string };

export function hookTargets(home: string): readonly HookTarget[] {
  return [
    { engine: "claude", file: path.join(home, ".claude", "settings.json") },
    { engine: "codex", file: path.join(home, ".codex", "hooks.json") },
  ];
}

export async function installLiveHooks(options: {
  readonly home: string;
  readonly launcher: string;
  readonly remove: boolean;
}): Promise<{ readonly changed: readonly string[]; readonly skipped: readonly string[] }> {
  const changed: string[] = [];
  const skipped: string[] = [];

  for (const target of hookTargets(options.home)) {
    if (!existsSync(path.dirname(target.file))) {
      skipped.push(target.file);
      continue;
    }

    assertRegularDestination(target.file);

    const previous = await readFile(target.file, "utf8").catch(() => null);
    const next = withLiveHooks({
      text: previous,
      entries: liveHookEntries({ engine: target.engine, launcher: options.launcher }),
      remove: options.remove,
    });

    if (next !== previous) {
      const mode = previous === null ? 0o600 : (await stat(target.file)).mode & 0o777;

      await writeFile(target.file, next, { mode });
      changed.push(target.file);
    }
  }

  return { changed, skipped };
}
