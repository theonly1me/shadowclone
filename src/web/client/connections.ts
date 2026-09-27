import { element } from "./dom";

export function renderConnections(): void {
  const canvas = element("tree-connections");
  const stage = element("constellation").getBoundingClientRect();
  const root = element("tree-origin").getBoundingClientRect();
  const origin = {
    x: root.x + root.width / 2 - stage.x,
    y: root.y + root.height / 2 - stage.y,
  };

  canvas.setAttribute("viewBox", `0 0 ${stage.width} ${stage.height}`);
  canvas.replaceChildren();

  for (const branch of document.querySelectorAll(".branch")) {
    const nodes = [...branch.querySelectorAll(".node-gem")].map((node) => {
      const rectangle = node.getBoundingClientRect();

      return {
        x: rectangle.x + rectangle.width / 2 - stage.x,
        y: rectangle.y + rectangle.height / 2 - stage.y,
      };
    });

    const first = nodes[0];
    const last = nodes.at(-1);

    if (!first || !last) {
      continue;
    }

    const route = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    const bend = Math.min(origin.y - 24, last.y + 74);

    route.setAttribute(
      "d",
      [
        `M${first.x} ${first.y}`,
        ...nodes.slice(1).map((node) => `L${node.x} ${node.y}`),
        `C${last.x} ${bend} ${last.x} ${origin.y} ${origin.x} ${origin.y}`,
      ].join(" "),
    );
    canvas.append(route);
  }
}

export function initializeConnections(): void {
  const observer = new ResizeObserver(renderConnections);

  observer.observe(element("constellation"));
}
