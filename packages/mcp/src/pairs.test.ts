import { describe, expect, test } from "bun:test";
import type { LiveSessions } from "@shadowclone/live";
import { createPairTool, createPeerTool } from "./pairs";
import { handleMcpRequest } from "./protocol";

type Calls = { readonly pairs: string[][]; readonly notes: { key: string; text: string }[] };

function fakeLive(calls: Calls): LiveSessions {
  return {
    list: async () => [],
    get: async () => null,
    send: async () => ({ kind: "refused", reason: "Not in this test." }),
    pair: async ({ first, second }) => {
      calls.pairs.push([first, second]);

      return {
        kind: "paired",
        pair: "pair-0a1b2c3d",
        deliveries: [
          { session: first, delivery: { kind: "queued", detail: "It waits." } },
          { session: second, delivery: { kind: "typed", detail: "Typed." } },
        ],
      };
    },
    unpair: async (pair) => ({ kind: "unpaired", pair }),
    pairs: async () => [
      {
        id: "pair-0a1b2c3d",
        sessions: ["live-11111111", "live-22222222"],
        sent: 3,
        createdAt: "2026-10-18T12:00:00Z",
      },
    ],
    peerSend: async (note) => {
      calls.notes.push(note);

      return note.key === "f".repeat(32)
        ? { kind: "refused", reason: "This key belongs to no open pair." }
        : { kind: "sent", to: "live-22222222", left: 19, delivery: { kind: "queued", detail: "It waits." } };
    },
  };
}

function text(result: unknown): string {
  return JSON.stringify(result);
}

describe("the pair and peer tools", () => {
  test("the server that sessions load offers shadowclone_peer, and never shadowclone_pair", () => {
    const listed = text(handleMcpRequest({ request: { id: 1, method: "tools/list", params: {} }, context: "" }));

    expect(listed).toContain('"name":"shadowclone_peer"');
    expect(listed).not.toContain("shadowclone_pair");
  });

  test("a session sends a note with its key, and a wrong key returns an error", async () => {
    const calls: Calls = { pairs: [], notes: [] };
    const peer = createPeerTool({ live: fakeLive(calls) });
    const key = "a".repeat(32);
    const sent = await peer.run({
      name: "shadowclone_peer",
      arguments: { operation: "send", key, text: "Rebase on my branch." },
    });
    const refused = await peer.run({
      name: "shadowclone_peer",
      arguments: { operation: "send", key: "f".repeat(32), text: "hi" },
    });
    const malformed = await peer.run({
      name: "shadowclone_peer",
      arguments: { operation: "send", key: "not-a-key", text: "hi" },
    });

    expect(calls.notes).toEqual([
      { key, text: "Rebase on my branch." },
      { key: "f".repeat(32), text: "hi" },
    ]);
    expect(sent).toEqual({
      content: [
        {
          type: "text",
          text: "Queued the note for live-22222222. It waits. The pair has 19 notes left.",
        },
      ],
      isError: false,
    });
    expect(refused?.isError).toBe(true);
    expect(malformed?.isError).toBe(true);
  });

  test("the owner pairs two sessions, lists the pair, and ends it", async () => {
    const calls: Calls = { pairs: [], notes: [] };
    const pairing = createPairTool({ live: fakeLive(calls) });
    const paired = await pairing.run({
      name: "shadowclone_pair",
      arguments: { operation: "pair", sessions: ["live-11111111", "live-22222222"] },
    });
    const listed = await pairing.run({ name: "shadowclone_pair", arguments: { operation: "list" } });
    const ended = await pairing.run({
      name: "shadowclone_pair",
      arguments: { operation: "unpair", pair: "pair-0a1b2c3d" },
    });
    const single = await pairing.run({
      name: "shadowclone_pair",
      arguments: { operation: "pair", sessions: ["live-11111111"] },
    });

    expect(calls.pairs).toEqual([["live-11111111", "live-22222222"]]);
    expect(text(paired)).toContain(
      "Paired live-11111111 and live-22222222 as pair-0a1b2c3d. The two sessions can send 20 notes in total.",
    );
    expect(text(listed)).toContain(
      "pair-0a1b2c3d live-11111111 live-22222222 3 of 20 notes sent, since 2026-10-18T12:00:00Z",
    );
    expect(text(ended)).toContain("Ended pair-0a1b2c3d.");
    expect(single?.isError).toBe(true);
  });
});
