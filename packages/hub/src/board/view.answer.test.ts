import { describe, expect, test } from "bun:test";
import { boardActions } from "./view/actions";
import { emptyState } from "./view/state";

type ToolCall = { readonly name: string; readonly arguments?: Record<string, unknown> };

function recordingHost() {
  const calls: ToolCall[] = [];
  const listed = Promise.withResolvers<void>();

  return {
    calls,
    listed: listed.promise,
    host: {
      callServerTool: async (params: ToolCall) => {
        calls.push(params);

        if (params.arguments?.operation === "list") {
          listed.resolve();
        }

        return { content: [{ type: "text" as const, text: "The answer reached the session." }] };
      },
      requestDisplayMode: async () => ({ mode: "inline" as const }),
    },
  };
}

describe("the answer action of the session board", () => {
  test("answers through shadowclone_clone with the question id, then refreshes the board", async () => {
    const { calls, listed, host } = recordingHost();
    const state = emptyState();

    state.drafts.set("live-0000000c", "Keep it for two releases");
    boardActions({ app: host, state, render: () => undefined }).answer({
      id: "live-0000000c",
      question: "qabc123",
      text: "Keep it",
    });
    await listed;

    expect(calls).toEqual([
      {
        name: "shadowclone_clone",
        arguments: {
          operation: "answer",
          id: "live-0000000c",
          question: "qabc123",
          text: "Keep it",
        },
      },
      { name: "shadowclone_sessions", arguments: { operation: "list" } },
    ]);
    expect(state.notices.get("live-0000000c")?.text).toBe("The answer reached the session.");
    expect(state.drafts.has("live-0000000c")).toBe(false);
  });
});
