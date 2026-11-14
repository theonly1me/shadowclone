import { mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { clonesPaths, localNode } from "@shadowclone/clones";
import { handleLiveHook, liveId, livePaths, localLive, type LivePaths } from "@shadowclone/live";
import { createSessionsTools } from "../sessions";
import { createAskTool } from ".";

const sessionId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

export const askedSession = liveId({ engine: "claude", sessionId });

export type AskHome = {
  readonly paths: LivePaths;
  readonly ask: (argumentsValue: unknown) => Promise<string>;
  readonly tool: (options: {
    readonly name: string;
    readonly arguments: unknown;
  }) => Promise<string>;
  readonly hook: (event: string) => Promise<void>;
  readonly typed: string[];
  readonly remove: () => Promise<void>;
};

export async function askHome(
  options: { readonly taskBriefs?: boolean; readonly waitMilliseconds?: number } = {},
): Promise<AskHome> {
  const home = await realpath(await mkdtemp(path.join(os.tmpdir(), "shadowclone-ask-")));
  const paths = livePaths(home);
  const typed: string[] = [];
  const live = localLive({
    paths,
    enabled: async () => true,
    taskBriefs: async () => options.taskBriefs ?? true,
    typeText: async (entry) => {
      typed.push(entry.text);

      return true;
    },
    questionTiming: {
      waitMilliseconds: options.waitMilliseconds ?? 5_000,
      pollMilliseconds: 10,
      handoffMilliseconds: 500,
    },
  });
  const environment = { TMUX_PANE: "%3" };
  const askTool = createAskTool({ live, environment });
  const sessions = createSessionsTools({ node: localNode({ paths: clonesPaths(home) }), live });
  const hook = async (event: string) => {
    await handleLiveHook({
      context: {
        paths,
        engine: "claude",
        now: new Date(),
        environment,
        gitFacts: async () => ({ repository: "you/app", branch: "feat/flags" }),
        typeText: async () => true,
      },
      input: JSON.stringify({ session_id: sessionId, hook_event_name: event, cwd: "/work/app" }),
    });
  };

  await hook("SessionStart");

  return {
    paths,
    typed,
    hook,
    ask: async (argumentsValue) =>
      JSON.stringify(await askTool.run({ name: "shadowclone_ask", arguments: argumentsValue })),
    tool: async (call) => JSON.stringify(await sessions.run(call)),
    remove: () => rm(home, { recursive: true, force: true }),
  };
}

export const flagQuestion = {
  session: askedSession,
  question: "Keep the old flag name for one release?",
  options: ["Keep it", "Remove it now"],
  recommended: "Keep it",
};
