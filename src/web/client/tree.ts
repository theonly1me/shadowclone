import type { BrowserItem } from "../protocol";
import { create, element } from "./dom";
import { editor, equipped } from "./state";
import { skillIcon } from "./icons";
import { featuredSkills, skillTitle } from "./presentation";

const branchNames = {
  craft: "CRAFT",
  verification: "VERIFICATION",
  autonomy: "AUTONOMY",
};

function skillNode(options: {
  readonly item: BrowserItem;
  readonly inspect: (id: string) => void;
}): HTMLButtonElement {
  const node = create({ tag: "button", className: "skill-node" });

  node.classList.toggle("active", editor.activeId === options.item.id);
  node.classList.toggle("equipped", equipped(options.item));
  node.setAttribute(
    "aria-pressed",
    String(editor.activeId === options.item.id),
  );
  node.setAttribute(
    "aria-label",
    `${options.item.title}${equipped(options.item) ? ", equipped" : ""}`,
  );

  const gem = create({ tag: "span", className: "node-gem" });
  const icon = create({
    tag: "span",
    className: "node-icon",
  });

  icon.setAttribute("aria-hidden", "true");
  icon.append(skillIcon(options.item));
  gem.append(icon);

  node.append(
    gem,
    create({
      tag: "span",
      className: "node-label",
      text: skillTitle(options.item),
    }),
  );
  node.addEventListener("click", () => options.inspect(options.item.id));

  return node;
}

export function renderTree(options: {
  readonly inspect: (id: string) => void;
}): void {
  const tree = element("tree");

  tree.replaceChildren();

  for (const branch of ["craft", "verification", "autonomy"] as const) {
    const column = create({ tag: "div", className: "branch" });

    column.append(
      create({
        tag: "h3",
        className: "branch-title",
        text: branchNames[branch],
      }),
    );

    const matches =
      editor.view?.items.filter(
        (item) =>
          item.branch === branch &&
          `${skillTitle(item)} ${item.title} ${item.description}`
            .toLowerCase()
            .includes(editor.search.toLowerCase()),
      ) ?? [];

    matches.sort((left, right) => {
      const leftIndex = featuredSkills.indexOf(left.id);
      const rightIndex = featuredSkills.indexOf(right.id);

      return (
        (leftIndex < 0 ? 100 : leftIndex) - (rightIndex < 0 ? 100 : rightIndex)
      );
    });

    for (const item of matches) {
      column.append(skillNode({ item, inspect: options.inspect }));
    }

    if (matches.length === 0) {
      column.append(
        create({
          tag: "p",
          className: "branch-empty",
          text: "No matching skills",
        }),
      );
    }

    tree.append(column);
  }
}
