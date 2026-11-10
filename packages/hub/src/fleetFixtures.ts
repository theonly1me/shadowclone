import type { CloneStartInput, CloneView } from "@shadowclone/clones";
import type { LiveRecord, LiveSessions } from "@shadowclone/live";
import { answerHub } from "./fleet/client";
import { parseMessage, toNodeSchema } from "./fleet/protocol";
import { fakeNode, type TestHub } from "./fixtures";

export function sampleView(options: {
  readonly id: string;
  readonly repository: string;
}): CloneView {
  return {
    id: options.id,
    repository: options.repository,
    kind: "work",
    summary: `work on ${options.repository}`,
    task: "fix the parser",
    state: "working",
    branch: `shadowclone/${options.id}`,
    pull: null,
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
}

export function sampleRecord(options: {
  readonly id: string;
  readonly state: LiveRecord["state"];
}): LiveRecord {
  return {
    id: options.id,
    engine: "claude",
    repository: "you/app",
    branch: "main",
    folder: "app",
    state: options.state,
    startedAt: "2026-10-18T11:00:00Z",
    updatedAt: "2026-10-18T11:30:00Z",
    summary: `Session ${options.id} finished a step.`,
    attention: null,
    surface: null,
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
    pairs: async () => [],
    peerSend: async () => refused,
  };
}

export function attachTextNode(options: {
  readonly hub: TestHub;
  readonly name: string;
  readonly result?: unknown;
}): void {
  const { hub, name } = options;
  const result = options.result ?? {
    content: [{ type: "text", text: "No clones on this machine." }],
    isError: false,
  };

  hub.store.joinNode(name);
  hub.links.connect({
    name,
    socket: {
      send: (text) => {
        const message = toNodeSchema.parse(parseMessage(text));

        hub.links.receive({
          name,
          text: JSON.stringify({ type: "result", id: message.id, result }),
        });
      },
      close: () => undefined,
    },
  });
}

export function attachNode(options: {
  readonly hub: TestHub;
  readonly name: string;
  readonly clones: readonly CloneView[];
  readonly live?: LiveSessions;
}): { readonly started: CloneStartInput[] } {
  const { hub, name } = options;
  const started: CloneStartInput[] = [];
  const node = fakeNode(started, options.clones);

  hub.store.joinNode(name);
  hub.links.connect({
    name,
    socket: {
      send: (text) => {
        const message = toNodeSchema.parse(parseMessage(text));

        answerHub({ message, node, ...(options.live === undefined ? {} : { live: options.live }) })
          .then((result) =>
            hub.links.receive({
              name,
              text: JSON.stringify({ type: "result", id: message.id, result }),
            }),
          )
          .catch(() => undefined);
      },
      close: () => undefined,
    },
  });

  return { started };
}
