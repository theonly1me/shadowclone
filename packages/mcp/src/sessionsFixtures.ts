import type { CloneNode, CloneView } from "@shadowclone/clones";
import type { LiveRecord, LiveSessions } from "@shadowclone/live";

export const sampleClone: CloneView = {
  id: "clone001",
  repository: "you/api",
  kind: "work",
  summary: "fix the parser",
  task: "fix the parser",
  state: "working",
  branch: "shadowclone/clone001",
  pull: 12,
  engine: "claude",
  createdAt: "2026-10-18T11:00:00Z",
  startedAt: "2026-10-18T11:00:05Z",
  updatedAt: "2026-10-18T11:30:00Z",
  detail: "The agent is working.",
  events: [],
  questions: [],
  needsYou: false,
  report: null,
};

export const idleRecord: LiveRecord = {
  id: "live-0a1b2c3d",
  engine: "codex",
  repository: "you/app",
  branch: "fix/parser",
  folder: "app",
  state: "idle",
  startedAt: "2026-10-18T11:00:00Z",
  updatedAt: "2026-10-18T11:30:00Z",
  summary: "\nThe parser now keeps quoted commas.\nShould I open the pull request?",
  attention: null,
  surface: { kind: "cmux", surface: "surface-1", socket: null },
};

export const waitingRecord: LiveRecord = {
  id: "live-4e5f6a7b",
  engine: "claude",
  repository: "you/web",
  branch: null,
  folder: "web",
  state: "needs-you",
  startedAt: "2026-10-18T10:00:00Z",
  updatedAt: "2026-10-18T11:45:00Z",
  summary: "I ran the tests.",
  attention: "Allow Bash: bun test?",
  surface: null,
};

export function fakeClones(clones: readonly CloneView[]): CloneNode {
  const refused = { kind: "refused", reason: "The fake node changes nothing." } as const;

  return {
    start: async () => refused,
    send: async () => refused,
    answer: async () => refused,
    list: async () => ({ clones, unreadable: [] }),
    get: async (id) => clones.find((clone) => clone.id === id) ?? null,
    stop: async () => ({ kind: "unknown" }),
  };
}

export function fakeLive(records: readonly LiveRecord[]): LiveSessions {
  const refused = { kind: "refused", reason: "Not in this test." } as const;

  return {
    enabled: async () => true,
    list: async () => records,
    get: async (id) => records.find((record) => record.id === id) ?? null,
    send: async () => refused,
    pair: async () => refused,
    unpair: async () => refused,
    pairs: async () => [
      {
        id: "pair-0a1b2c3d",
        sessions: ["live-0a1b2c3d", "live-4e5f6a7b"],
        sent: 4,
        createdAt: "2026-10-18T11:10:00Z",
      },
    ],
    peerSend: async () => refused,
  };
}
