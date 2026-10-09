import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { checkBoundaries } from "./boundaries";
import { findCycle, findViolations, observedGraph } from "./boundaries/check";
import { readImports } from "./boundaries/imports";
import type { ManifestIndex, WorkspaceKey, WorkspaceManifest } from "./boundaries/manifests";

function edgesOf(files: Record<string, string>) {
  return Object.entries(files).flatMap(([file, text]) => readImports({ file, text }));
}

function manifestOf(options: {
  readonly key: WorkspaceKey;
  readonly exportedSubpaths?: readonly string[];
  readonly workspaceDependencies?: readonly string[];
}): [WorkspaceKey, WorkspaceManifest] {
  return [
    options.key,
    {
      file: `${options.key}/package.json`,
      name: `@shadowclone/${options.key}`,
      version: null,
      isPrivate: true,
      exportedSubpaths: options.exportedSubpaths ?? ["."],
      workspaceDependencies: options.workspaceDependencies ?? [],
    },
  ];
}

const manifests: ManifestIndex = new Map([
  manifestOf({ key: "core", exportedSubpaths: [".", "./testing"] }),
  manifestOf({ key: "redact", workspaceDependencies: ["@shadowclone/core"] }),
  manifestOf({ key: "agents" }),
  manifestOf({ key: "root", workspaceDependencies: ["@shadowclone/core", "@shadowclone/redact"] }),
  manifestOf({ key: "evals", workspaceDependencies: ["@shadowclone/core"] }),
]);

function messagesFor(files: Record<string, string>) {
  return findViolations({ edges: edgesOf(files), manifests }).map((violation) => violation.message);
}

test("a declared, exported, allowed package import passes in a package, a root module, and evals", () => {
  expect(
    messagesFor({
      "packages/redact/src/a.ts": 'import { x } from "@shadowclone/core";',
      "packages/redact/src/b.test.ts": 'import { y } from "@shadowclone/core/testing";',
      "src/cli/a.ts": 'import { z } from "@shadowclone/redact";',
      "evals/fixed/a.ts": 'import { x } from "@shadowclone/core";',
    }),
  ).toEqual([]);
});

test("a subpath that the target does not export is reported", () => {
  expect(
    messagesFor({ "src/cli/a.ts": 'import { x } from "@shadowclone/redact/internal/rules";' }),
  ).toEqual([
    '"@shadowclone/redact/internal/rules" is not listed in the exports of @shadowclone/redact',
  ]);
});

test("a package that the importing package.json does not declare is reported", () => {
  expect(
    messagesFor({ "packages/redact/src/a.ts": 'import { x } from "@shadowclone/agents";' }),
  ).toEqual([
    "@shadowclone/agents is not declared in the package.json that owns this file",
    '"@shadowclone/agents" makes redact depend on agents',
  ]);
  expect(messagesFor({ "evals/fixed/a.ts": 'import { x } from "@shadowclone/redact";' })).toEqual([
    "@shadowclone/redact is not declared in the package.json that owns this file",
  ]);
});

test("a package that imports its own name, a missing package, or a higher package is reported", () => {
  expect(
    messagesFor({
      "packages/core/src/config/a.ts": 'import { x } from "@shadowclone/core";',
      "packages/core/src/config/b.ts": 'import { x } from "@shadowclone/missing";',
    }),
  ).toEqual([
    "@shadowclone/core is not declared in the package.json that owns this file",
    '"@shadowclone/core" makes core import its own package',
    '"@shadowclone/missing" is not a workspace package',
  ]);
});

test("a relative import that leaves its package folder is reported, and one that stays is not", () => {
  expect(
    messagesFor({
      "packages/redact/src/a.ts": 'import { x } from "../../core/src/paths";',
      "packages/redact/src/b.ts": 'import { y } from "../../../src/cli/doctor";',
      "packages/redact/src/c.ts": 'import { z } from "./rules";',
    }),
  ).toEqual([
    '"../../core/src/paths" leaves its package',
    '"../../../src/cli/doctor" leaves its package',
  ]);
});

test("a root module and evals cannot reach into a package folder by a relative path", () => {
  expect(
    messagesFor({
      "src/cli/a.ts": 'import { x } from "../../packages/core/src/paths";',
      "evals/fixed/a.ts": 'import { y } from "../../packages/core/src/paths";',
      "evals/fixed/b.ts": 'import { z } from "../../src/cli/doctor";',
    }),
  ).toEqual([
    '"../../packages/core/src/paths" reaches into core, import the package by name',
    '"../../packages/core/src/paths" leaves its package',
  ]);
});

test("the observed graph counts a package import by name and reports the cycle that it closes", () => {
  const edges = edgesOf({
    "packages/core/src/config/a.ts": 'import { x } from "@shadowclone/redact";',
    "packages/redact/src/a.ts": 'import { x } from "@shadowclone/core";',
  });

  expect(findCycle(observedGraph({ edges }))).toEqual(["core", "redact", "core"]);
});

async function treeWith(files: Record<string, string>): Promise<string> {
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-boundaries-"));

  for (const [file, text] of Object.entries(files)) {
    await Bun.write(path.join(rootDirectory, file), text);
  }

  return rootDirectory;
}

test("the checker reports a package.json that breaks the rules", async () => {
  const rootDirectory = await treeWith({
    "package.json": JSON.stringify({
      name: "@shadowclone/cli",
      devDependencies: { "@shadowclone/nope": "workspace:*" },
    }),
    "packages/redact/package.json": JSON.stringify({
      name: "@shadowclone/redact",
      version: "1.0.0",
      dependencies: { "@shadowclone/agents": "workspace:*" },
    }),
    "packages/redact/src/a.ts": "export const a = 1;\n",
  });

  const report = await checkBoundaries({ rootDirectory });

  expect(report.fileCount).toBe(1);
  expect(report.violations.map((violation) => [violation.file, violation.message])).toEqual([
    ["package.json", "@shadowclone/nope is not a workspace package"],
    ["packages/redact/package.json", "a workspace package must be private"],
    ["packages/redact/package.json", "a workspace package has no version"],
    ["packages/redact/package.json", "agents is not a dependency that redact may declare"],
  ]);
});
