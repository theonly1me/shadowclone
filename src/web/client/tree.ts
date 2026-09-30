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
import { hubIcon, skillIcon } from "./icons";
import { constellationBranchCounts, constellationFit, revealMatchingBranches, visibleConstellation } from "./constellationVisibility";
import { skillTitle } from "./presentation";
import { editor, equipped } from "./state";

const namespace = "http://www.w3.org/2000/svg";
let inspectItem: (id: string) => void = () => undefined;
let focusedHubId = "";
let currentZoom: ZoomBehavior<SVGSVGElement, unknown> | null = null;
const expandedHubIds = new Set<string>();
let librarySignature = "";
let branchCounts: ReadonlyMap<string, number> = new Map();
let currentLayout: ReturnType<typeof layoutConstellation> | null = null;
let itemsById: ReadonlyMap<string, BrowserItem> = new Map();

function svgElement(name: string): SVGElement {
  return document.createElementNS(namespace, name);
}

function itemFor(node: PositionedConstellationNode): BrowserItem | undefined {
  const items = node.itemIds
    .map((id) => itemsById.get(id))
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

function labelLines(title: string): readonly string[] {
  const lines: string[] = [""];
  for (const word of title.split(/\s+/)) {
    const last = lines.at(-1) ?? "";
    if (last && last.length + word.length > 22) lines.push(word);
    else lines[lines.length - 1] = `${last} ${word}`.trim();
  }
  return lines.slice(0, 2).map((line, index) =>
    `${line.slice(0, 24)}${(index === 1 && lines.length > 2) || line.length > 24 ? "…" : ""}`);
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
    gem.setAttribute("r", "26");
  } else {
    const size = node.kind === "hub" ? 32 : 24;
    gem.setAttribute("x", String(-size / 2));
    gem.setAttribute("y", String(-size / 2));
    gem.setAttribute("width", String(size));
    gem.setAttribute("height", String(size));
    gem.setAttribute("rx", "6");
    gem.setAttribute("transform", "rotate(45)");
  }

  label.setAttribute("text-anchor", "middle");
  for (const [index, line] of labelLines(nodeTitle(node)).entries()) {
    const span = svgElement("tspan");
    span.setAttribute("x", "0");
    span.setAttribute("y", String((node.kind === "root" ? 44 : 38) + index * 14));
    span.textContent = line;
    label.append(span);
  }
  const title = svgElement("title");
  title.textContent = nodeTitle(node);
  container.append(title);
  container.append(gem, label);

  if (node.kind === "root") {
    const mark = document.querySelector(".brand-mark");
    if (mark instanceof HTMLImageElement) {
      const image = svgElement("image");
      image.setAttribute("href", mark.src);
      for (const [attribute, value] of Object.entries({ x: "-16", y: "-16", width: "32", height: "32" })) image.setAttribute(attribute, value);
      container.append(image);
    }
  } else {
    const icon = svgElement("foreignObject");
    const iconContainer = create({ tag: "span", className: "map-node-icon" });
    icon.setAttribute("x", "-9");
    icon.setAttribute("y", "-9");
    icon.setAttribute("width", "18");
    icon.setAttribute("height", "18");
    iconContainer.append(item ? skillIcon(item) : hubIcon(node.title));
    icon.append(iconContainer);
    container.append(icon);
  }

  if (node.kind === "hub") {
    container.setAttribute("aria-expanded", String(expandedHubIds.has(node.id)));
    const count = svgElement("text");
    count.setAttribute("class", "map-node-count");
    count.setAttribute("text-anchor", "middle");
    count.setAttribute("y", "70");
    const total = branchCounts.get(node.id) ?? 0;
    count.textContent = `${expandedHubIds.has(node.id) ? "−" : "+"} ${total} ${total === 1 ? "skill" : "skills"}`;
    container.append(count);
  }

  const activate = (): void => {
    if (item) inspectItem(item.id);
    else if (node.kind === "hub") {
      if (expandedHubIds.has(node.id)) expandedHubIds.delete(node.id);
      else expandedHubIds.add(node.id);
      focusedHubId = node.id;
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
  renderConstellationList({ constellation: view.constellation, inspect: inspectItem });

  const bounds = canvas.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) return;
  itemsById = new Map(view.items.map((item) => [item.id, item]));
  const signature = [...view.constellation.hubs.map((hub) => `${hub.id}:${hub.parentId}`), ...view.constellation.leaves.map((leaf) => leaf.id)].join("\n");
  const changed = signature !== librarySignature;
  if (changed) {
    expandedHubIds.clear();
    if (view.constellation.leaves.length <= 40) for (const hub of view.constellation.hubs) expandedHubIds.add(hub.id);
    librarySignature = signature;
    focusedHubId = "";
  }
  if (editor.search) revealMatchingBranches({ constellation: view.constellation, expandedHubIds,
    matchingItemIds: new Set(view.items.filter((item) => `${skillTitle(item)} ${item.description}`.toLowerCase().includes(editor.search.toLowerCase())).map((item) => item.id)) });
  branchCounts = constellationBranchCounts(view.constellation);
  const layout = layoutConstellation({
    constellation: visibleConstellation({ constellation: view.constellation, expandedHubIds }),
    width: bounds.width,
    height: bounds.height,
  });
  currentLayout = layout;
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
    .scaleExtent([0.1, 2.5])
    .on("zoom", (event) => {
      group.setAttribute("transform", event.transform.toString());
    });
  select(canvas).call(behavior);
  group.setAttribute("transform", zoomTransform(canvas).toString());
  currentZoom = behavior;
  if (changed) {
    const fit = constellationFit({ nodes: layout.nodes, width: bounds.width, height: bounds.height });
    select(canvas).call(behavior.transform, zoomIdentity.translate(fit.x, fit.y).scale(Math.max(0.65, fit.scale)));
  }
  const focusTarget = editor.search
    ? layout.nodes.find((node) => node.kind === "skill" && matchesSearch(node))
    : focusedHubId
    ? layout.nodes.find((node) => node.id === focusedHubId)
    : undefined;

  if (focusTarget && (focusedHubId || editor.search)) {
    const transform = zoomIdentity
      .translate(bounds.width / 2, bounds.height / 2)
      .scale(1.25)
      .translate(-focusTarget.x, -focusTarget.y);
    select(canvas).call(behavior.transform, transform);
  }
}

export function initializeTree(): void {
  const canvas = svg("constellation-map");
  const rerender = (): void => renderTree({ inspect: inspectItem });
  new ResizeObserver(rerender).observe(canvas);
  const resetView = (): void => {
    focusedHubId = "";
    if (currentZoom) select(canvas).call(currentZoom.transform, zoomIdentity);
  };
  element("fit-constellation").addEventListener("click", () => {
    if (!currentZoom || !currentLayout) return;
    focusedHubId = "";
    const bounds = canvas.getBoundingClientRect();
    const fit = constellationFit({ nodes: currentLayout.nodes, width: bounds.width, height: bounds.height });
    select(canvas).call(currentZoom.transform, zoomIdentity.translate(fit.x, fit.y).scale(fit.scale));
  });
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
