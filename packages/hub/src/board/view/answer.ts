import { element } from "./elements";
import { questionBlock } from "./question";
import { optionButtons, replyForm } from "./reply";
import type { SessionView } from "./session";
import type { BoardActions, ViewState } from "./state";

export function answerBlock(options: {
  readonly view: SessionView;
  readonly state: ViewState;
  readonly actions: BoardActions;
}): HTMLElement[] {
  const { view, state, actions } = options;

  if (view.question !== null) {
    return [];
  }

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

  const { id } = view.session;

  return [
    ...optionButtons({ id, state, actions, brief: view.brief }),
    replyForm({
      id,
      state,
      prompt: "Type your reply",
      submitLabel: "Send",
      submit: (text) => actions.send({ id, text }),
    }),
  ];
}

export function openQuestion(options: {
  readonly view: SessionView;
  readonly state: ViewState;
  readonly actions: BoardActions;
}): HTMLElement[] {
  const { view, state, actions } = options;

  return view.question === null
    ? []
    : questionBlock({ id: view.session.id, question: view.question, state, actions });
}
