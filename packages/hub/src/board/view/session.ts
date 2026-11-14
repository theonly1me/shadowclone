import { briefWaitsForOwner, type BoardBrief } from "@shadowclone/live/board";
import type { FleetSession } from "../schema";
import { briefLines } from "./brief";
import { button, element } from "./elements";
import { ageText, type Notice, type SessionDetail } from "./model";
import { optionButtons, replyForm } from "./reply";
import type { BoardActions, ViewState } from "./state";

const stateWords: Readonly<Record<FleetSession["state"], string>> = {
  "needs-you": "Needs you",
  idle: "Your turn",
  working: "Working",
  ended: "Ended",
};

type SessionView = {
  readonly session: Pick<FleetSession, "id" | "state" | "repository" | "branch" | "updatedAt">;
  readonly node: string | null;
  readonly message: string;
  readonly attention: string | null;
  readonly brief: BoardBrief | null;
};

export function sessionView(options: {
  readonly session: FleetSession;
  readonly state: ViewState;
  readonly showNode: boolean;
}): SessionView {
  const detail = options.state.details.get(options.session.id);

  return {
    session: options.session,
    node: options.showNode ? options.session.node : null,
    message: detail?.summary.trim() || options.session.message,
    attention:
      detail?.attention ?? (options.session.state === "needs-you" ? options.session.message : null),
    brief: options.session.brief ?? null,
  };
}

export function detailView(detail: SessionDetail): SessionView {
  return {
    session: detail,
    node: null,
    message: detail.summary.trim(),
    attention: detail.attention,
    brief: null,
  };
}

export function noticeLine(notice: Notice | undefined): HTMLElement[] {
  return notice === undefined
    ? []
    : [element({ tag: "p", className: `notice ${notice.tone}`, text: notice.text })];
}

export function statusLine(notice: Notice | null): HTMLElement[] {
  return notice === null
    ? []
    : [element({ tag: "p", className: `status ${notice.tone}`, text: notice.text })];
}

function stateWord(view: SessionView): string {
  if (view.brief === null) {
    return stateWords[view.session.state];
  }

  return briefWaitsForOwner(view.brief) ? "Needs you" : "Ready for you";
}

function heading(view: SessionView): HTMLElement {
  const line = element({ tag: "span", className: "heading" });
  const mark = element({ tag: "span", className: `mark ${view.session.state}` });

  mark.setAttribute("aria-hidden", "true");
  line.append(
    mark,
    element({ tag: "span", className: "word", text: stateWord(view) }),
    element({ tag: "span", className: "repository", text: view.session.repository }),
    ...(view.session.branch === null
      ? []
      : [element({ tag: "span", className: "code", text: view.session.branch })]),
    ...(view.node === null ? [] : [element({ tag: "span", className: "quiet", text: view.node })]),
    element({
      tag: "span",
      className: "quiet age",
      text: ageText({ updatedAt: view.session.updatedAt, now: Date.now() }),
    }),
  );

  return line;
}

function answerBlock(options: {
  readonly view: SessionView;
  readonly state: ViewState;
  readonly actions: BoardActions;
}): HTMLElement[] {
  const { view } = options;

  if (view.session.state === "needs-you") {
    return [
      ...(view.attention === null
        ? []
        : [element({ tag: "p", className: "prompt", text: view.attention })]),
      element({
        tag: "p",
        className: "quiet",
        text: "Answer it in the terminal or in Remote Control.",
      }),
    ];
  }

  if (view.session.state !== "idle") {
    return [];
  }

  const target = { id: view.session.id, state: options.state, actions: options.actions };

  return [...optionButtons({ ...target, brief: view.brief }), replyForm(target)];
}

export function sessionCard(options: {
  readonly view: SessionView;
  readonly state: ViewState;
  readonly actions: BoardActions;
}): HTMLElement {
  const card = element({ tag: "article", className: `card ${options.view.session.state}` });

  card.append(
    heading(options.view),
    ...briefLines(options.view.brief),
    element({ tag: "p", className: "loud", text: options.view.message }),
    ...answerBlock(options),
    ...noticeLine(options.state.notices.get(options.view.session.id)),
  );

  return card;
}

export function sessionRow(options: {
  readonly view: SessionView;
  readonly state: ViewState;
  readonly actions: BoardActions;
  readonly extra: readonly HTMLElement[];
}): HTMLElement {
  const { view, state, actions } = options;
  const opened = state.opened === view.session.id;
  const row = element({ tag: "div", className: "row" });
  const toggle = button({
    label: "",
    className: "row-toggle",
    onClick: () => actions.open(view.session.id),
  });

  toggle.setAttribute("aria-expanded", String(opened));
  toggle.append(
    heading(view),
    ...briefLines(view.brief),
    element({ tag: "span", className: "message", text: view.message }),
  );
  row.append(
    toggle,
    ...(opened ? answerBlock({ view, state, actions }) : []),
    ...options.extra,
    ...noticeLine(state.notices.get(view.session.id)),
  );

  return row;
}
