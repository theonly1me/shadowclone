import type { App } from "@modelcontextprotocol/ext-apps";
import { boardDetailSchema } from "@shadowclone/live/board";
import { fleetBoardSchema } from "../schema";
import { deliveryNotice, type Notice } from "./model";
import { boardNoticeKey, pairsNoticeKey, type BoardActions, type ViewState } from "./state";

type Answer = { readonly text: string; readonly isError: boolean; readonly structured: unknown };

function failureNotice(error: unknown): Notice {
  return {
    tone: "fault",
    text: error instanceof Error ? error.message : "The host did not answer.",
  };
}

export function readAnswer(result: {
  readonly content?: readonly { readonly type: string; readonly text?: unknown }[];
  readonly isError?: boolean;
  readonly structuredContent?: unknown;
}): Answer {
  return {
    text: (result.content ?? [])
      .map((part) => (part.type === "text" && typeof part.text === "string" ? part.text : ""))
      .join("\n"),
    isError: result.isError ?? false,
    structured: result.structuredContent,
  };
}

export function showAnswer(options: { readonly state: ViewState; readonly answer: Answer }): void {
  const { state, answer } = options;
  const board = fleetBoardSchema.safeParse(answer.structured);
  const detail = boardDetailSchema.safeParse(answer.structured);

  if (board.success) {
    state.board = board.data;
    state.notices.delete(boardNoticeKey);
  } else if (detail.success) {
    state.details.set(detail.data.session.id, detail.data.session);
    state.opened = detail.data.session.id;
  } else if (answer.text !== "") {
    state.notices.set(boardNoticeKey, deliveryNotice(answer));
  }
}

export function boardActions(options: {
  readonly app: App;
  readonly state: ViewState;
  readonly render: () => void;
}): BoardActions {
  const { app, state, render } = options;

  async function call(params: {
    readonly name: string;
    readonly arguments: Readonly<Record<string, unknown>>;
  }): Promise<Answer> {
    return readAnswer(
      await app.callServerTool({ name: params.name, arguments: { ...params.arguments } }),
    );
  }

  function run(options: { readonly noticeKey: string; readonly work: () => Promise<void> }): void {
    state.busy = true;
    render();
    options
      .work()
      .catch((error: unknown) => state.notices.set(options.noticeKey, failureNotice(error)))
      .finally(() => {
        state.busy = false;
        render();
      });
  }

  async function refresh(): Promise<void> {
    showAnswer({
      state,
      answer: await call({ name: "shadowclone_sessions", arguments: { operation: "list" } }),
    });
  }

  return {
    refresh: () => run({ noticeKey: boardNoticeKey, work: refresh }),
    open: (id) => {
      if (state.opened === id) {
        state.opened = null;
        render();

        return;
      }

      state.opened = id;
      run({
        noticeKey: id,
        work: async () =>
          showAnswer({
            state,
            answer: await call({
              name: "shadowclone_sessions",
              arguments: { operation: "get", id },
            }),
          }),
      });
    },
    send: ({ id, text }) =>
      run({
        noticeKey: id,
        work: async () => {
          const answer = await call({
            name: "shadowclone_clone",
            arguments: { operation: "send", id, text },
          });

          state.notices.set(id, deliveryNotice(answer));

          if (!answer.isError) {
            state.drafts.delete(id);
          }

          await refresh();
        },
      }),
    startPairing: () => {
      state.pairing = true;
      state.pairingFirst = null;
      render();
    },
    cancelPairing: () => {
      state.pairing = false;
      state.pairingFirst = null;
      render();
    },
    choose: (id) => {
      const first = state.pairingFirst;

      if (first === null) {
        state.pairingFirst = id;
        render();

        return;
      }

      state.pairing = false;
      state.pairingFirst = null;
      run({
        noticeKey: pairsNoticeKey,
        work: async () => {
          const answer = await call({
            name: "shadowclone_pair",
            arguments: { operation: "pair", sessions: [first, id] },
          });

          state.notices.set(pairsNoticeKey, deliveryNotice(answer));
          await refresh();
        },
      });
    },
    unpair: (pair) =>
      run({
        noticeKey: pairsNoticeKey,
        work: async () => {
          const answer = await call({
            name: "shadowclone_pair",
            arguments: { operation: "unpair", pair },
          });

          state.notices.set(pairsNoticeKey, deliveryNotice(answer));
          await refresh();
        },
      }),
    fullscreen: () => {
      app.requestDisplayMode({ mode: "fullscreen" }).catch((error: unknown) => {
        state.notices.set(boardNoticeKey, failureNotice(error));
        render();
      });
    },
  };
}
