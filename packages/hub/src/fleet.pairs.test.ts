import { describe, expect, test } from "bun:test";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { handleLiveHook, livePaths, localLive, type LiveRecord } from "@shadowclone/live";
import { testHub } from "./fixtures";
import { connect, rpc } from "./oauthSteps";

async function startSession(options: {
  readonly home: string;
  readonly engine: LiveRecord["engine"];
  readonly sessionId: string;
}): Promise<void> {
  const context = {
    paths: livePaths(options.home),
    engine: options.engine,
    now: new Date("2026-10-18T12:00:00Z"),
    environment: {},
    gitFacts: async () => ({ repository: "you/app", branch: "main" }),
    typeText: async () => false,
  };

  for (const event of ["SessionStart", "UserPromptSubmit"]) {
    await handleLiveHook({
      context,
      input: JSON.stringify({ session_id: options.sessionId, hook_event_name: event, cwd: "/work/app" }),
    });
  }
}

describe("pairing live sessions through the hub", () => {
  test("the connector pairs two sessions of the hub machine, lists the pair, and refuses an unknown session", async () => {
    const home = await realpath(await mkdtemp(path.join(os.tmpdir(), "shadowclone-hub-pairs-")));
    const live = localLive({
      paths: livePaths(home),
      enabled: async () => true,
      typeText: async () => false,
      now: () => new Date("2026-10-18T12:00:00Z"),
    });
    const hub = await testHub({ live });

    try {
      await startSession({ home, engine: "claude", sessionId: "first-session" });
      await startSession({ home, engine: "codex", sessionId: "second-session" });

      const { accessToken } = await connect(hub);
      const call = async (argumentsOfCall: Readonly<Record<string, unknown>>) => {
        const response = await hub.call(
          rpc({
            token: accessToken,
            method: "tools/call",
            params: { name: "shadowclone_pair", arguments: argumentsOfCall },
          }),
        );
        const body = await response.json();

        return { text: String(body.result.content[0].text), isError: Boolean(body.result.isError) };
      };
      const [first, second] = (await live.list()).map((record) => record.id);
      const paired = await call({ operation: "pair", sessions: [first, second] });
      const listed = await call({ operation: "list" });
      const unknown = await call({ operation: "pair", sessions: [first, "live-ffffffff"] });

      expect(paired.isError).toBe(false);
      expect(paired.text).toMatch(/^Paired live-[0-9a-f]{8} and live-[0-9a-f]{8} as pair-[0-9a-f]{8}\./);
      expect(listed.text).toContain("0 of 20 notes sent");
      expect(unknown).toEqual({
        text: "No live session live-ffffffff exists on this machine.",
        isError: true,
      });
    } finally {
      await hub.remove();
      await rm(home, { recursive: true, force: true });
    }
  });
});
