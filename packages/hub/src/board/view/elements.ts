export function element<Tag extends keyof HTMLElementTagNameMap>(options: {
  readonly tag: Tag;
  readonly className?: string;
  readonly text?: string;
}): HTMLElementTagNameMap[Tag] {
  const node = document.createElement(options.tag);

  if (options.className !== undefined) {
    node.className = options.className;
  }

  if (options.text !== undefined) {
    node.textContent = options.text;
  }

  return node;
}

export function button(options: {
  readonly label: string;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly onClick: () => void;
}): HTMLButtonElement {
  const node = element({
    tag: "button",
    className: options.className ?? "action",
    text: options.label,
  });

  node.type = "button";
  node.disabled = options.disabled ?? false;
  node.addEventListener("click", options.onClick);

  return node;
}

export function section(options: {
  readonly title: string;
  readonly children: readonly HTMLElement[];
}): HTMLElement {
  const node = element({ tag: "section", className: "group" });

  node.append(element({ tag: "h2", text: options.title }), ...options.children);

  return node;
}
