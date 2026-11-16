import { briefNeed, type BoardBrief } from "@shadowclone/live/board";
import { element } from "./elements";

export const briefLabel = "Summary by a model";

export function doneLine(brief: BoardBrief | null): HTMLElement[] {
  return brief === null || brief.done === ""
    ? []
    : [element({ tag: "span", className: "brief-done", text: `Done: ${brief.done}` })];
}

export function briefLines(options: {
  readonly brief: BoardBrief | null;
  readonly withDone: boolean;
}): HTMLElement[] {
  const { brief } = options;

  if (brief === null) {
    return [];
  }

  return [
    element({ tag: "span", className: "brief-name", text: brief.name }),
    element({ tag: "span", className: "brief-goal", text: brief.goal }),
    ...(options.withDone ? doneLine(brief) : []),
    element({ tag: "span", className: "brief-need", text: briefNeed(brief) }),
    element({ tag: "span", className: "quiet brief-label", text: briefLabel }),
  ];
}
