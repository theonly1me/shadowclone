import path from "node:path";
import {
  declaredGraph,
  findCycle,
  findViolations,
  observedGraph,
  type BoundaryViolation,
} from "./boundaries/check";
import { readImports, type ImportEdge } from "./boundaries/imports";
import { packageLayout } from "./boundaries/packages";

export type BoundaryReport = {
  readonly fileCount: number;
  readonly violations: readonly BoundaryViolation[];
  readonly declaredCycle: readonly string[] | null;
  readonly observedCycle: readonly string[] | null;
};

export async function checkBoundaries(options: { rootDirectory: string }): Promise<BoundaryReport> {
  const glob = new Bun.Glob(`${packageLayout.sourceRoot}/**/*.ts`);
  const edges: ImportEdge[] = [];
  let fileCount = 0;

  for await (const file of glob.scan({ cwd: options.rootDirectory })) {
    const text = await Bun.file(path.join(options.rootDirectory, file)).text();

    fileCount += 1;
    edges.push(...readImports({ file, text }));
  }

  return {
    fileCount,
    violations: findViolations({ edges }),
    declaredCycle: findCycle(declaredGraph()),
    observedCycle: findCycle(observedGraph({ edges })),
  };
}

if (import.meta.main) {
  const report = await checkBoundaries({ rootDirectory: process.cwd() });
  const ordered = [...report.violations].sort(
    (left, right) => left.file.localeCompare(right.file) || left.line - right.line,
  );

  for (const violation of ordered) {
    console.error(`${violation.file}:${violation.line}: ${violation.message}`);
  }

  for (const cycle of [report.declaredCycle, report.observedCycle]) {
    if (cycle) {
      console.error(`package cycle: ${cycle.join(" -> ")}`);
    }
  }

  const failed =
    ordered.length > 0 || report.declaredCycle !== null || report.observedCycle !== null;

  console.log(`boundaries: ${ordered.length} violations in ${report.fileCount} files`);

  if (failed) {
    process.exit(1);
  }
}
