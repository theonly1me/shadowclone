import { select } from "d3-selection";
import {
  zoom,
  zoomIdentity,
  zoomTransform,
  type ZoomBehavior,
} from "d3-zoom";
import type { BrowserItem } from "../protocol";
import { renderConstellationList } from "./constellationList";
import {
  layoutConstellation,
  type PositionedConstellationNode,
} from "./constellationLayout";
import { create, element, svg } from "./dom";
import { skillIcon } from "./icons";
import { skillTitle } from "./presentation";
import { editor, equipped } from "./state";

const namespace = "http://www.w3.org/2000/svg";
let inspectItem: (id: string) => void = () => undefined;
let focusedHubId = "";
let currentZoom: ZoomBehavior<SVGSVGElement, unknown> | null = null;

function svgElement(name: string): SVGElement {
  return document.createElementNS(namespace, name);
}

function itemFor(node: PositionedConstellationNode): BrowserItem | undefined {
  const items = node.itemIds
    .map((id) => editor.view?.items.find((item) => item.id === id))
    .filter((item): item is BrowserItem => item !== undefined);

  return items.find(equipped) ?? items[0];
}

function nodeTitle(node: PositionedConstellationNode): string {
  const item = itemFor(node);

  return item ? skillTitle(item) : node.title;
}

function matchesSearch(node: PositionedConstellationNode): boolean {
  if (!editor.search) return true;
  const item = itemFor(node);

  return `${nodeTitle(node)} ${item?.description ?? ""}`
    .toLowerCase()
    .includes(editor.search.toLowerCase());
}

function mapNode(options: {
  readonly group: SVGElement;
  readonly node: PositionedConstellationNode;
}): void {
  const { group, node } = options;
  const item = itemFor(node);
  const container = svgElement("g");
  const gem = svgElement(node.kind === "root" ? "circle" : "rect");
  const label = svgElement("text");
  const selected = item ? equipped(item) : false;

  container.setAttribute("class", `map-node map-node-${node.kind}`);
  container.setAttribute("transform", `translate(${node.x} ${node.y})`);
  container.classList.toggle("equipped", selected);
  container.classList.toggle("search-miss", !matchesSearch(node));
  container.classList.toggle("focused", node.id === focusedHubId);
  container.setAttribute("role", "button");
  container.setAttribute("tabindex", "0");
  container.setAttribute(
    "aria-label",
    `${nodeTitle(node)}${selected ? ", equipped" : ""}`,
  );

  if (node.kind === "root") {
    gem.setAttribute("r", "18");
  } else {
    const size = node.kind === "hub" ? 32 : 24;
    gem.setAttribute("x", String(-size / 2));
    gem.setAttribute("y", String(-size / 2));
    gem.setAttribute("width", String(size));
    gem.setAttribute("height", String(size));
    gem.setAttribute("rx", "6");
    gem.setAttribute("transform", "rotate(45)");
  }

  label.textContent = nodeTitle(node);
  label.setAttribute("y", node.kind === "root" ? "36" : "34");
  label.setAttribute("text-anchor", "middle");
  container.append(gem, label);

  if (item) {
    const icon = svgElement("foreignObject");
    const iconContainer = create({ tag: "span", className: "map-node-icon" });
    icon.setAttribute("x", "-9");
    icon.setAttribute("y", "-9");
    icon.setAttribute("width", "18");
    icon.setAttribute("height", "18");
    iconContainer.append(skillIcon(item));
    icon.append(iconContainer);
    container.append(icon);
  }

  const activate = (): void => {
    if (item) inspectItem(item.id);
    else if (node.kind === "hub") {
      focusedHubId = focusedHubId === node.id ? "" : node.id;
    }
    renderTree({ inspect: inspectItem });
  };

  container.addEventListener("click", activate);
  container.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activate();
    }
  });
  group.append(container);
}

export function renderTree(options: {
  readonly inspect: (id: string) => void;
}): void {
  inspectItem = options.inspect;
  const canvas = svg("constellation-map");
  const view = editor.view;

  if (!view) return;

  const bounds = canvas.getBoundingClientRect();
  const layout = layoutConstellation({
    constellation: view.constellation,
    width: bounds.width,
    height: bounds.height,
  });
  canvas.setAttribute("viewBox", `0 0 ${bounds.width} ${bounds.height}`);
  canvas.replaceChildren();
  const group = svgElement("g");
  group.setAttribute("class", "constellation-viewport");
  canvas.append(group);

  for (const link of layout.links) {
    const path = svgElement("path");
    path.setAttribute("class", link.related ? "map-link related" : "map-link");
    path.setAttribute(
      "d",
      `M${link.sourceX} ${link.sourceY}L${link.targetX} ${link.targetY}`,
    );
    group.append(path);
  }

  for (const node of layout.nodes) mapNode({ group, node });

  const behavior = zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.45, 2.5])
    .on("zoom", (event) => {
      group.setAttribute("transform", event.transform.toString());
    });
  select(canvas).call(behavior);
  group.setAttribute("transform", zoomTransform(canvas).toString());
  currentZoom = behavior;
  const focusTarget = focusedHubId
    ? layout.nodes.find((node) => node.id === focusedHubId)
    : layout.nodes.find(
        (node) => node.kind === "skill" && matchesSearch(node),
      );

  if (focusTarget && (focusedHubId || editor.search)) {
    const transform = zoomIdentity
      .translate(bounds.width / 2, bounds.height / 2)
      .scale(1.25)
      .translate(-focusTarget.x, -focusTarget.y);
    select(canvas).call(behavior.transform, transform);
  }
  renderConstellationList({
    constellation: view.constellation,
    inspect: inspectItem,
  });
}

export function initializeTree(): void {
  const canvas = svg("constellation-map");
  const rerender = (): void => renderTree({ inspect: inspectItem });
  new ResizeObserver(rerender).observe(canvas);
  const resetView = (): void => {
    focusedHubId = "";
    if (currentZoom) select(canvas).call(currentZoom.transform, zoomIdentity);
  };
  element("fit-constellation").addEventListener("click", resetView);
  element("reset-constellation").addEventListener("click", resetView);
  const toggle = element("toggle-constellation-view");
  toggle.addEventListener("click", () => {
    const listView = element("constellation").classList.toggle("list-view");
    toggle.setAttribute("aria-pressed", String(listView));
  });
}

export function refreshTree(): void {
  renderTree({ inspect: inspectItem });
}
