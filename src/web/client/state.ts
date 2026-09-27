import type { BuildInput } from "../../builds/types";
import type { BrowserItem, BuildView } from "../protocol";

type EditorState = {
  view: BuildView | null;
  input: BuildInput;
  activeId: string;
  search: string;
  dirty: boolean;
};

export const editor: EditorState = {
  view: null,
  input: { scope: "global", choices: {}, edits: {}, custom: [] },
  activeId: "",
  search: "",
  dirty: false,
};

export function equipped(item: BrowserItem): boolean {
  const locked = editor.view?.locked[item.id];

  if (locked !== undefined) {
    return locked;
  }

  const configured = editor.input.choices[item.id];

  if (configured !== undefined) {
    return configured;
  }

  if (
    item.id.startsWith("custom:") &&
    editor.input.custom.some((skill) => item.id === `custom:${skill.name}`)
  ) {
    return true;
  }

  return editor.view?.inherited[item.id] === true;
}

export function setEquipped(item: BrowserItem): void {
  if (editor.view?.locked[item.id] !== undefined) {
    return;
  }

  const enabled = !equipped(item);

  editor.input.choices[item.id] = enabled;

  if (enabled && item.axis) {
    for (const sibling of editor.view?.items ?? []) {
      if (sibling.axis === item.axis && sibling.id !== item.id) {
        editor.input.choices[sibling.id] = false;
        delete editor.input.edits[sibling.id];
      }
    }
  }

  if (!enabled) {
    delete editor.input.edits[item.id];
  }

  editor.dirty = true;
}
