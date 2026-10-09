import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { checkBoundaries } from "./boundaries";
import {
  declaredGraph,
  findCycle,
  findViolations,
  observedGraph,
  packageOfFile,
} from "./boundaries/check";
import { readImports } from "./boundaries/imports";

function edgesOf(files: Record<string, string>) {
  return Object.entries(files).flatMap(([file, text]) => readImports({ file, text }));
}

async function treeWith(files: Record<string, string>): Promise<string> {
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-boundaries-"));

  for (const [file, text] of Object.entries(files)) {
    await Bun.write(path.join(rootDirectory, file), text);
  }

  return rootDirectory;
}

test("reads value, type, dynamic, re-export, and side-effect imports with their line numbers", () => {
  const edges = readImports({
    file: "src/cli/a.ts",
    text: [
      'import { one } from "../config";',
      'import type { Two } from "../paths";',
      "",
      'export { three } from "../io/files";',
      'const lazy = await import("../mcp");',
      'import "../storage";',
      'import { z } from "zod";',
    ].join("\n"),
  });

  expect(edges.map((edge) => [edge.line, edge.specifier])).toEqual([
    [1, "../config"],
    [2, "../paths"],
    [4, "../io/files"],
    [5, "../mcp"],
    [6, "../storage"],
    [7, "zod"],
  ]);
});

test("a file belongs to the package that owns its top-level module", () => {
  expect(packageOfFile({ file: "src/paths.test.ts" })).toBe("core");
  expect(packageOfFile({ file: "src/product.json" })).toBe("core");
  expect(packageOfFile({ file: "src/eventIndex/store.ts" })).toBe("sessions");
  expect(packageOfFile({ file: "src/skillMaintenance/state.ts" })).toBe("skills");
  expect(packageOfFile({ file: "src/cli/harnessCommands/init.test.ts" })).toBe("cli");
  expect(packageOfFile({ file: "src/unlisted/a.ts" })).toBeNull();
  expect(packageOfFile({ file: "evals/shared/a.ts" })).toBeNull();
});

test("an import inside a package and an import of an allowed package pass", () => {
  const edges = edgesOf({
    "src/cli/a.ts": 'import { x } from "../config";\nimport { y } from "./b";',
    "src/skills/a.ts": 'import type { z } from "../changes";',
    "src/builds/a.test.ts": 'import { z } from "../environment/store";',
  });

  expect(findViolations({ edges })).toEqual([]);
});

test("a value import, a type import, and a test import that break the table are reported with their position", () => {
  const edges = edgesOf({
    "src/config/a.ts": '\nimport { x } from "../cli/doctor";',
    "src/redact/b.ts": 'import type { Y } from "../observe";',
    "src/skills/c.test.ts": 'const a = 1;\nimport { z } from "../learning/state";',
  });

  expect(findViolations({ edges })).toEqual([
    {
      file: "src/config/a.ts",
      line: 2,
      message: '"../cli/doctor" makes core depend on cli',
    },
    {
      file: "src/redact/b.ts",
      line: 1,
      message: '"../observe" makes redact depend on sessions',
    },
    {
      file: "src/skills/c.test.ts",
      line: 2,
      message: '"../learning/state" makes skills depend on learning',
    },
  ]);
});

test("an import that leaves the source root or reaches an unlisted module is reported", () => {
  const edges = edgesOf({
    "src/mcp/a.ts": 'import data from "../../package.json";',
    "src/mcp/b.ts": 'import { x } from "../unlisted/x";',
    "src/unlisted/c.ts": 'import { x } from "../config";',
  });

  expect(findViolations({ edges }).map((violation) => violation.message)).toEqual([
    '"../../package.json" resolves to package.json, which belongs to no package',
    '"../unlisted/x" resolves to src/unlisted/x, which belongs to no package',
    "file belongs to no package",
  ]);
});

test("a cycle between packages is found, and an acyclic graph has none", () => {
  const cycle = findCycle(
    new Map([
      ["a", new Set(["b"])],
      ["b", new Set(["c"])],
      ["c", new Set(["a"])],
    ]),
  );

  expect(cycle).toEqual(["a", "b", "c", "a"]);
  expect(
    findCycle(
      new Map([
        ["a", new Set(["b"])],
        ["b", new Set()],
      ]),
    ),
  ).toBeNull();
});

test("the declared dependency table and an import graph that follows it have no cycle", () => {
  const edges = edgesOf({
    "src/cli/a.ts": 'import { x } from "../mcp";',
    "src/mcp/a.ts": 'import { x } from "../environment";',
    "src/environment/a.ts": 'import { x } from "../config";',
  });

  expect(findCycle(declaredGraph())).toBeNull();
  expect(findCycle(observedGraph({ edges }))).toBeNull();
});

test("the observed graph reports a cycle that the import edges form", () => {
  const edges = edgesOf({
    "src/config/a.ts": 'import { x } from "../redact";',
    "src/redact/a.ts": 'import { x } from "../config";',
  });

  expect(findCycle(observedGraph({ edges }))).toEqual(["core", "redact", "core"]);
});

test("the checker reads every source file under src and counts the files it read", async () => {
  const rootDirectory = await treeWith({
    "src/config/a.ts": 'import { x } from "../cli/doctor";\n',
    "src/cli/doctor.ts": "export const x = 1;\n",
    "docs/ignored.ts": 'import { x } from "../src/cli/doctor";\n',
  });

  const report = await checkBoundaries({ rootDirectory });

  expect(report.fileCount).toBe(2);
  expect(report.violations).toEqual([
    {
      file: "src/config/a.ts",
      line: 1,
      message: '"../cli/doctor" makes core depend on cli',
    },
  ]);
  expect(report.observedCycle).toBeNull();
});
