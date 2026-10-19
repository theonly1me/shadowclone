import type { CloneStartInput, CloneView } from "@shadowclone/clones";
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

export function attachNode(options: {
  readonly hub: TestHub;
  readonly name: string;
  readonly clones: readonly CloneView[];
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

        answerHub({ message, node })
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
