import type { FleetBoard } from "../schema";
import { button, element, section } from "./elements";
import { noticeLine } from "./session";
import { pairsNoticeKey, type BoardActions, type ViewState } from "./state";

function pairRow(options: {
  readonly pair: FleetBoard["pairs"][number];
  readonly board: FleetBoard;
  readonly state: ViewState;
  readonly actions: BoardActions;
}): HTMLElement {
  const { pair } = options;
  const [first, second] = pair.sessions;
  const row = element({ tag: "div", className: "row" });

  row.append(
    element({ tag: "p", className: "code", text: `${first} and ${second}` }),
    element({ tag: "p", className: "quiet", text: `${pair.sent} of ${pair.limit} notes` }),
    ...(pair.node === options.board.hub
      ? [
          button({
            label: "Unpair",
            disabled: options.state.busy,
            onClick: () => options.actions.unpair(pair.id),
          }),
        ]
      : []),
  );

  return row;
}

function pairingControls(options: {
  readonly state: ViewState;
  readonly actions: BoardActions;
}): HTMLElement[] {
  const { state, actions } = options;

  if (!state.pairing) {
    return [
      button({ label: "Pair two sessions", disabled: state.busy, onClick: actions.startPairing }),
    ];
  }

  return [
    element({
      tag: "p",
      className: "quiet",
      text:
        state.pairingFirst === null
          ? "Tap Pair on the first session."
          : `Tap Pair on the session to pair with ${state.pairingFirst}.`,
    }),
    button({ label: "Cancel", onClick: actions.cancelPairing }),
  ];
}

export function pairsSection(options: {
  readonly board: FleetBoard;
  readonly state: ViewState;
  readonly actions: BoardActions;
}): HTMLElement {
  const { board, state, actions } = options;

  return section({
    title: "Pairs",
    children: [
      ...board.pairs.map((pair) => pairRow({ pair, board, state, actions })),
      ...pairingControls({ state, actions }),
      ...noticeLine(state.notices.get(pairsNoticeKey)),
    ],
  });
}

export function pairButton(options: {
  readonly id: string;
  readonly state: ViewState;
  readonly actions: BoardActions;
}): HTMLElement[] {
  const { id, state, actions } = options;

  return state.pairing && state.pairingFirst !== id
    ? [button({ label: "Pair", disabled: state.busy, onClick: () => actions.choose(id) })]
    : [];
}
