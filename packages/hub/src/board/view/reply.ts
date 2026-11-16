import type { BoardBrief } from "@shadowclone/live/board";
import { button, element } from "./elements";
import type { BoardActions, ViewState } from "./state";

export function replyForm(options: {
  readonly id: string;
  readonly state: ViewState;
  readonly actions: BoardActions;
}): HTMLElement {
  const form = element({ tag: "form", className: "reply" });
  const field = element({ tag: "textarea" });
  const { drafts } = options.state;

  field.rows = 1;
  field.placeholder = "Type your reply";
  field.setAttribute("aria-label", "Your reply");
  field.value = drafts.get(options.id) ?? "";
  field.addEventListener("input", () => drafts.set(options.id, field.value));
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (field.value.trim() !== "") {
      options.actions.send({ id: options.id, text: field.value });
    }
  });

  const send = element({ tag: "button", className: "action primary", text: "Send" });

  send.type = "submit";
  send.disabled = options.state.busy;
  form.append(field, send);

  return form;
}

export function optionButtons(options: {
  readonly id: string;
  readonly brief: BoardBrief | null;
  readonly state: ViewState;
  readonly actions: BoardActions;
}): HTMLElement[] {
  const { id, brief, state, actions } = options;

  if (brief?.kind !== "question" || brief.options.length === 0) {
    return [];
  }

  const list = element({ tag: "div", className: "options" });

  list.append(
    ...brief.options.map((option) =>
      button({
        label: option,
        className: "action option",
        disabled: state.busy,
        onClick: () => actions.send({ id, text: option }),
      }),
    ),
  );

  return [list];
}
