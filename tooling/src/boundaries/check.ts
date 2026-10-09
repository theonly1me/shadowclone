import { resolveRelativeImport, type ImportEdge } from "./imports";
import { packageFolderOf, packageOfFile, workspaceKeyOfFile } from "./layout";
import type { ManifestIndex } from "./manifests";
import { packageLayout, packageNames, type PackageLayout } from "./packages";
import { parseWorkspaceSpecifier } from "./specifiers";
import { workspaceImportViolations } from "./workspaceImports";

export { packageOfFile } from "./layout";

export type BoundaryViolation = {
  readonly file: string;
  readonly line: number;
  readonly message: string;
};

export type PackageGraph = ReadonlyMap<string, ReadonlySet<string>>;

function consumerViolations(options: {
  readonly edge: ImportEdge;
  readonly target: string;
  readonly workspace: string;
}): readonly BoundaryViolation[] {
  const { edge, target, workspace } = options;
  const staysInside = target.startsWith(`${workspace}/`) || target.startsWith("src/");

  return staysInside
    ? []
    : [{ file: edge.file, line: edge.line, message: `"${edge.specifier}" leaves its package` }];
}

function relativeViolations(options: {
  readonly edge: ImportEdge;
  readonly target: string;
  readonly layout: PackageLayout;
}): readonly BoundaryViolation[] {
  const { edge, target, layout } = options;
  const position = { file: edge.file, line: edge.line };
  const workspace = workspaceKeyOfFile(edge.file);

  if (workspace === "evals" || workspace === "tooling") {
    return consumerViolations({ edge, target, workspace });
  }

  const importer = packageOfFile({ file: edge.file, layout });
  const imported = packageOfFile({ file: target, layout });

  if (importer === null) {
    return [{ ...position, message: "file belongs to no package" }];
  }

  if (packageFolderOf(edge.file) !== null) {
    return packageFolderOf(target) === importer
      ? []
      : [{ ...position, message: `"${edge.specifier}" leaves its package` }];
  }

  if (packageFolderOf(target) !== null) {
    return [
      {
        ...position,
        message: `"${edge.specifier}" reaches into ${imported}, import the package by name`,
      },
    ];
  }

  if (imported === null) {
    return [
      {
        ...position,
        message: `"${edge.specifier}" resolves to ${target}, which belongs to no package`,
      },
    ];
  }

  return importer !== imported && !layout.allowedDependencies[importer].includes(imported)
    ? [{ ...position, message: `"${edge.specifier}" makes ${importer} depend on ${imported}` }]
    : [];
}

export function findViolations(options: {
  edges: readonly ImportEdge[];
  layout?: PackageLayout;
  manifests?: ManifestIndex;
}): readonly BoundaryViolation[] {
  const layout = options.layout ?? packageLayout;
  const manifests = options.manifests ?? new Map();
  const violations: BoundaryViolation[] = [];

  for (const edge of options.edges) {
    if (parseWorkspaceSpecifier(edge.specifier) !== null) {
      violations.push(...workspaceImportViolations({ edge, manifests, layout }));
      continue;
    }

    const target = resolveRelativeImport(edge);

    if (target !== null) {
      violations.push(...relativeViolations({ edge, target, layout }));
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
    const workspace = parseWorkspaceSpecifier(edge.specifier);
    const target = resolveRelativeImport(edge);
    const importer = packageOfFile({ file: edge.file, layout });
    const imported =
      workspace !== null
        ? (packageNames.find((name) => name === workspace.packageName) ?? null)
        : target === null
          ? null
          : packageOfFile({ file: target, layout });

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
