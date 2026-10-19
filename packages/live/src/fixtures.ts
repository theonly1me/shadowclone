import { mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { HookContext } from "./hook";
import { livePaths, type LivePaths } from "./paths";
import type { Surface } from "./record";

export type TypedText = { readonly surface: Surface; readonly text: string };

export async function temporaryHome(): Promise<{
  readonly home: string;
  readonly paths: LivePaths;
  readonly remove: () => Promise<void>;
}> {
  const home = await realpath(await mkdtemp(path.join(os.tmpdir(), "shadowclone-live-")));

  return { home, paths: livePaths(home), remove: () => rm(home, { recursive: true, force: true }) };
}

export function hookContext(options: {
  readonly paths: LivePaths;
  readonly environment?: Readonly<Record<string, string>>;
  readonly engine?: "claude" | "codex";
  readonly typed?: TypedText[];
}): HookContext {
  const { typed } = options;

  return {
    paths: options.paths,
    engine: options.engine ?? "claude",
    now: new Date("2026-10-18T12:00:00Z"),
    environment: options.environment ?? {},
    gitFacts: async () => ({ repository: "you/app", branch: "fix/parser" }),
    typeText: async (entry) => {
      typed?.push(entry);

      return typed !== undefined;
    },
  };
}

export function hookInput(event: string, fields: Readonly<Record<string, unknown>> = {}): string {
  return JSON.stringify({
    session_id: "11111111-2222-3333-4444-555555555555",
    hook_event_name: event,
    cwd: "/work/app",
    ...fields,
  });
}
