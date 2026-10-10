import { expect, test } from "bun:test";
import { mkdir, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseDiff } from "../collect/diff";
import { stackProjects } from "./projects";
import { runStack } from "./stackRun";
import { rustStack } from "./stacks/compiled";
import type { Stack } from "./types";

async function tree(files: Readonly<Record<string, string>>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "shadowclone-projects-"));

  for (const [file, text] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await Bun.write(path.join(root, file), text);
  }

  return root;
}

test("a Rust workspace below the repository root is checked in the crate of each changed file", async () => {
  const root = await tree({
    "package.json": "{}",
    "codex-rs/Cargo.toml": "[workspace]\n",
    "codex-rs/core/Cargo.toml": "[package]\n",
    "codex-rs/core/src/lib.rs": "",
    "codex-rs/tui/Cargo.toml": "[package]\n",
    "codex-rs/tui/src/app.rs": "",
  });

  const projects = stackProjects({
    stacks: [rustStack],
    root,
    changedFiles: ["codex-rs/core/src/lib.rs", "codex-rs/core/src/mods.rs", "codex-rs/tui/src/app.rs", "README.md"],
  });

  expect(projects.map((project) => project.directory)).toEqual(["codex-rs/core", "codex-rs/tui"]);
});

test("a diagnostic printed inside a project folder matches the changed line in the repository", async () => {
  const root = await tree({ "web/manifest.txt": "", "web/src/a.ts": "export const a = 2;\n" });
  await Bun.write(path.join(root, "web", "diagnostics.txt"), "src/a.ts(1,14): error TS2322: Type 'number' is not assignable to type 'string'.\n");
  const stack: Stack = {
    id: "fixture",
    sources: /\.ts$/,
    detect: (context) => context.exists("manifest.txt"),
    install: () => null,
    commands: [{ tool: "lint", scope: "changed-lines", parser: "paren", command: () => ["sh", "-c", "cat diagnostics.txt; exit 1"] }],
  };
  const files = parseDiff(["diff --git a/web/src/a.ts b/web/src/a.ts", "--- a/web/src/a.ts", "+++ b/web/src/a.ts", "@@ -1 +1 @@", "-export const a = 1;", "+export const a = 2;", ""].join("\n"));
  const head = { root, roots: [root] };

  const [report] = await runStack({ stack, directory: "web", head, base: async () => head, files, onProgress: () => {}, budget: { deadline: Date.now() + 60_000, environment: {} } });

  expect(report?.stack).toBe("fixture (web)");
  expect(report?.diagnostics.map((diagnostic) => `${diagnostic.path}:${diagnostic.line}`)).toEqual(["web/src/a.ts:1"]);
});
