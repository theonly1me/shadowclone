import type { FleetBoard, FleetSession } from "../schema";
import { button, element, section } from "./elements";
import {
  canPair,
  emptyText,
  endedText,
  headline,
  loudSession,
  nodeNotice,
  sessionGroups,
} from "./model";
import { pairButton, pairsSection } from "./pairs";
import {
  detailView,
  noticeLine,
  sessionCard,
  sessionRow,
  sessionView,
  statusLine,
} from "./session";
import { boardNoticeKey, type BoardActions, type ViewState } from "./state";

type Context = {
  readonly board: FleetBoard;
  readonly state: ViewState;
  readonly actions: BoardActions;
};

function rows(options: { readonly context: Context; readonly sessions: readonly FleetSession[] }) {
  const { board, state, actions } = options.context;
  const showNode = board.nodes.length > 1;

  return options.sessions.map((session) =>
    sessionRow({
      view: sessionView({ session, state, showNode }),
      state,
      actions,
      extra: canPair({ board, session }) ? pairButton({ id: session.id, state, actions }) : [],
    }),
  );
}

function notices(context: Context): HTMLElement[] {
  return context.board.nodes.flatMap((node) => statusLine(nodeNotice(node)));
}

function inlineBoard(context: Context): HTMLElement[] {
  const { board, state, actions } = context;
  const loud = loudSession(board);
  const groups = sessionGroups(board.sessions);
  const others = [...groups.needsYou, ...groups.yourTurn].filter((session) => session !== loud);

  return [
    ...headline(board).map((line) => element({ tag: "p", className: "headline", text: line })),
    ...(loud === null
      ? []
      : [
          sessionCard({
            view: sessionView({ session: loud, state, showNode: board.nodes.length > 1 }),
            state,
            actions,
          }),
        ]),
    ...rows({ context, sessions: others }),
    ...notices(context),
    ...(state.canFullscreen
      ? [button({ label: "Open the board", onClick: actions.fullscreen })]
      : []),
  ];
}

function fullBoard(context: Context): HTMLElement[] {
  const { board } = context;
  const groups = sessionGroups(board.sessions);
  const ended = endedText(board);
  const title =
    board.nodes.length > 1
      ? `Sessions on ${board.nodes.length} machines`
      : `Sessions on ${board.hub}`;
  const groupsInOrder = [
    { title: "Needs you", sessions: groups.needsYou },
    { title: "Your turn", sessions: groups.yourTurn },
    { title: "Working", sessions: groups.working },
  ].filter((group) => group.sessions.length > 0);

  return [
    element({ tag: "h1", text: title }),
    ...notices(context),
    ...groupsInOrder.map((group) =>
      section({ title: group.title, children: rows({ context, sessions: group.sessions }) }),
    ),
    pairsSection(context),
    ...(ended === null ? [] : [element({ tag: "p", className: "quiet", text: ended })]),
  ];
}

function boardContent(context: Context): HTMLElement[] {
  const empty = emptyText(context.board);

  if (empty !== null) {
    return [element({ tag: "p", className: "headline", text: empty }), ...notices(context)];
  }

  return context.state.fullscreen ? fullBoard(context) : inlineBoard(context);
}

function singleSession(options: { readonly state: ViewState; readonly actions: BoardActions }) {
  const { state, actions } = options;
  const detail = state.opened === null ? undefined : state.details.get(state.opened);

  return detail === undefined
    ? [element({ tag: "p", className: "quiet", text: "Tap Refresh to load your sessions." })]
    : [sessionCard({ view: detailView(detail), state, actions })];
}

export function renderBoard(options: {
  readonly root: HTMLElement;
  readonly state: ViewState;
  readonly actions: BoardActions;
}): void {
  const { root, state, actions } = options;
  const toolbar = element({ tag: "div", className: "toolbar" });

  toolbar.append(button({ label: "Refresh", disabled: state.busy, onClick: actions.refresh }));
  const content = [
    ...(state.board === null
      ? singleSession({ state, actions })
      : boardContent({ board: state.board, state, actions })),
    ...noticeLine(state.notices.get(boardNoticeKey)),
  ];

  root.replaceChildren(...(state.fullscreen ? [toolbar, ...content] : [...content, toolbar]));
}
