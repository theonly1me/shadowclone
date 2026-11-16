import type { BoardQuestion } from "@shadowclone/live/board";
import { button, element } from "./elements";
import { replyForm } from "./reply";
import type { BoardActions, ViewState } from "./state";

export const recommendedLabel = "Recommended";

function optionButton(options: {
  readonly option: string;
  readonly recommended: boolean;
  readonly state: ViewState;
  readonly choose: () => void;
}): HTMLButtonElement {
  const node = button({
    label: options.option,
    className: options.recommended ? "action option recommended" : "action option",
    disabled: options.state.busy,
    onClick: options.choose,
  });

  if (options.recommended) {
    node.append(element({ tag: "span", className: "recommended-mark", text: recommendedLabel }));
  }

  return node;
}

export function questionBlock(options: {
  readonly id: string;
  readonly question: BoardQuestion;
  readonly state: ViewState;
  readonly actions: BoardActions;
}): HTMLElement[] {
  const { id, question, state, actions } = options;
  const answer = (text: string) => actions.answer({ id, question: question.id, text });
  const list = element({ tag: "div", className: "options" });

  list.append(
    ...question.options.map((option) =>
      optionButton({
        option,
        recommended: option === question.recommended,
        state,
        choose: () => answer(option),
      }),
    ),
  );

  return [
    element({ tag: "p", className: "question-text", text: question.text }),
    list,
    replyForm({
      id,
      state,
      prompt: "Type another answer",
      submitLabel: "Answer",
      submit: answer,
    }),
  ];
}
