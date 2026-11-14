import { mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { EngineId } from "@shadowclone/agents";
import { handleLiveHook, liveId, livePaths, type LiveEngine, type LivePaths } from "@shadowclone/live";
import type { BriefModel, BriefModelRequest } from "./model";
import { writeBrief, type BriefOutcome } from "./writer";

export const syntheticToken = `ghp_${"d".repeat(36)}`;

export const validAnswer = {
  name: "Rename the parser",
  goal: "The owner wants the parser renamed.",
  done: "The agent renamed the parser and ran the tests.",
  kind: "question",
  question: "Should the old name stay as an alias?",
  options: ["Keep the alias", "Remove the alias"],
} as const;

export type FakeSession = {
  readonly paths: LivePaths;
  readonly requests: BriefModelRequest[];
  readonly hook: (event: string, fields?: Readonly<Record<string, unknown>>) => Promise<void>;
  readonly id: string;
  readonly brief: (options?: {
    readonly now?: Date;
    readonly model?: BriefModel;
    readonly allowedEngines?: readonly EngineId[];
  }) => Promise<BriefOutcome>;
  readonly remove: () => Promise<void>;
};

export async function fakeSession(
  options: { readonly engine?: LiveEngine; readonly answer?: () => Promise<unknown> } = {},
): Promise<FakeSession> {
  const home = await realpath(await mkdtemp(path.join(os.tmpdir(), "shadowclone-briefs-")));
  const paths = livePaths(home);
  const engine = options.engine ?? "claude";
  const requests: BriefModelRequest[] = [];
  const answer = options.answer ?? (async () => validAnswer);
  const model: BriefModel = async (request) => {
    requests.push(request);

    return answer();
  };
  const context = {
    paths,
    engine,
    now: new Date("2026-11-10T12:00:00Z"),
    environment: {},
    gitFacts: async () => ({ repository: "you/app", branch: "fix/parser" }),
    typeText: async () => false,
    taskBriefs: { startWriter: () => undefined },
  };
  const hook: FakeSession["hook"] = async (event, fields = {}) => {
    await handleLiveHook({
      context,
      input: JSON.stringify({ session_id: "fake-session", hook_event_name: event, cwd: "/work/app", ...fields }),
    });
  };

  await hook("SessionStart");

  const id = liveId({ engine, sessionId: "fake-session" });

  return {
    paths,
    requests,
    hook,
    id,
    brief: async (briefOptions = {}) =>
      writeBrief({
        paths,
        id,
        model: briefOptions.model ?? model,
        allowedEngines: briefOptions.allowedEngines ?? ["claude-code", "codex"],
        now: () => briefOptions.now ?? new Date("2026-11-10T12:00:00Z"),
      }),
    remove: () => rm(home, { recursive: true, force: true }),
  };
}
