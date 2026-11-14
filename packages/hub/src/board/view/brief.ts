import { briefNeed, type BoardBrief } from "@shadowclone/live/board";
import { element } from "./elements";

export const briefLabel = "Summary by a model";

export function briefLines(brief: BoardBrief | null): HTMLElement[] {
  if (brief === null) {
    return [];
  }

  return [
    element({ tag: "span", className: "brief-name", text: brief.name }),
    element({ tag: "span", className: "brief-goal", text: brief.goal }),
    element({ tag: "span", className: "brief-need", text: briefNeed(brief) }),
    element({ tag: "span", className: "quiet brief-label", text: briefLabel }),
  ];
}
