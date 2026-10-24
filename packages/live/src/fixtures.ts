import { mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { handleLiveHook, type HookContext } from "./hook";
import { livePaths, type LivePaths } from "./paths";
import { liveId, type Surface } from "./record";

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

export type SessionHandle = {
  readonly id: string;
  readonly hook: (event: string, fields?: Readonly<Record<string, unknown>>) => Promise<string>;
};

export function sessionHandle(options: {
  readonly paths: LivePaths;
  readonly engine: "claude" | "codex";
  readonly sessionId: string;
  readonly environment?: Readonly<Record<string, string>>;
  readonly typed?: TypedText[];
}): SessionHandle {
  const context = hookContext({
    paths: options.paths,
    engine: options.engine,
    ...(options.environment === undefined ? {} : { environment: options.environment }),
    ...(options.typed === undefined ? {} : { typed: options.typed }),
  });

  return {
    id: liveId({ engine: options.engine, sessionId: options.sessionId }),
    hook: async (event, fields = {}) =>
      JSON.stringify(
        await handleLiveHook({
          context,
          input: hookInput(event, { session_id: options.sessionId, ...fields }),
        }),
      ),
  };
}

export function peerKeyIn(text: string): string {
  const [, key] = /key ([0-9a-f]{32})/.exec(text) ?? [];

  if (key === undefined) {
    throw new Error(`No peer key in ${text}`);
  }

  return key;
}
