import path from "node:path";
import { resolveRelativeImport, type ImportEdge } from "./imports";
import { packageLayout, packageNames, type PackageLayout, type PackageName } from "./packages";

export type BoundaryViolation = {
  readonly file: string;
  readonly line: number;
  readonly message: string;
};

export type PackageGraph = ReadonlyMap<string, ReadonlySet<string>>;

function ownersOf(layout: PackageLayout): ReadonlyMap<string, PackageName> {
  const owners = new Map<string, PackageName>();

  for (const name of packageNames) {
    for (const moduleName of layout.modules[name]) {
      owners.set(moduleName, name);
    }
  }

  return owners;
}

export function packageOfFile(options: {
  file: string;
  layout?: PackageLayout;
}): PackageName | null {
  const layout = options.layout ?? packageLayout;
  const relative = path.posix.relative(layout.sourceRoot, options.file);

  if (relative.startsWith("..")) {
    return null;
  }

  const [segment] = relative.split("/");
  const [stem] = (segment ?? "").split(".");

  return ownersOf(layout).get(stem ?? "") ?? null;
}

export function findViolations(options: {
  edges: readonly ImportEdge[];
  layout?: PackageLayout;
}): readonly BoundaryViolation[] {
  const layout = options.layout ?? packageLayout;
  const violations: BoundaryViolation[] = [];

  for (const edge of options.edges) {
    const target = resolveRelativeImport(edge);

    if (target === null) {
      continue;
    }

    const importer = packageOfFile({ file: edge.file, layout });
    const imported = packageOfFile({ file: target, layout });
    const position = { file: edge.file, line: edge.line };

    if (importer === null) {
      violations.push({ ...position, message: "file belongs to no package" });
    } else if (imported === null) {
      violations.push({
        ...position,
        message: `"${edge.specifier}" resolves to ${target}, which belongs to no package`,
      });
    } else if (importer !== imported && !layout.allowedDependencies[importer].includes(imported)) {
      violations.push({
        ...position,
        message: `"${edge.specifier}" makes ${importer} depend on ${imported}`,
      });
    }
  }

  return violations;
}

export function observedGraph(options: {
  edges: readonly ImportEdge[];
  layout?: PackageLayout;
}): PackageGraph {
  const layout = options.layout ?? packageLayout;
  const graph = new Map<string, Set<string>>();

  for (const edge of options.edges) {
    const target = resolveRelativeImport(edge);
    const importer = packageOfFile({ file: edge.file, layout });
    const imported = target === null ? null : packageOfFile({ file: target, layout });

    if (importer === null || imported === null || importer === imported) {
      continue;
    }

    graph.set(importer, (graph.get(importer) ?? new Set()).add(imported));
  }

  return graph;
}

export function declaredGraph(layout: PackageLayout = packageLayout): PackageGraph {
  return new Map(packageNames.map((name) => [name, new Set(layout.allowedDependencies[name])]));
}

export function findCycle(graph: PackageGraph): readonly string[] | null {
  const finished = new Set<string>();

  function visit(options: { node: string; trail: readonly string[] }): readonly string[] | null {
    const start = options.trail.indexOf(options.node);

    if (start >= 0) {
      return [...options.trail.slice(start), options.node];
    }

    if (finished.has(options.node)) {
      return null;
    }

    for (const next of graph.get(options.node) ?? []) {
      const cycle = visit({
        node: next,
        trail: [...options.trail, options.node],
      });

      if (cycle) {
        return cycle;
      }
    }

    finished.add(options.node);

    return null;
  }

  for (const node of graph.keys()) {
    const cycle = visit({ node, trail: [] });

    if (cycle) {
      return cycle;
    }
  }

  return null;
}
