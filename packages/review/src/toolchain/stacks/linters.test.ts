import { expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseDiff } from "../../collect/diff";
import { stackProjects } from "../projects";
import { runStack } from "../stackRun";
import { allStacks } from ".";

const recordedOutput: Readonly<Record<string, string>> = {
  shellcheck: "deploy.sh:2:8: note: Double quote to prevent globbing and word splitting. [SC2086]",
  hadolint: "hadolint:Dockerfile:2: DL3008 warning: Pin versions in apt get install.",
  actionlint: '.github/workflows/ci.yml:9:24: "github.event.pull_request.title" is potentially untrusted. [expression]',
  zizmor: "::error file=.github/workflows/ci.yml,line=9,title=template-injection::ci.yml:9: code injection via template expansion",
  squawk: "migrations/1.sql:2:14: warning: adding-required-field Adding a new column that is `NOT NULL` and has no default value.",
};

const changedFiles: Readonly<Record<string, string>> = {
  shellcheck: "deploy.sh",
  hadolint: "Dockerfile",
  actionlint: ".github/workflows/ci.yml",
  zizmor: ".github/workflows/ci.yml",
  squawk: "migrations/1.sql",
};

function addedFile(filePath: string) {
  const lines = Array.from({ length: 10 }, (_, index) => `line ${index + 1}`);

  return parseDiff([`diff --git a/${filePath} b/${filePath}`, "new file mode 100644", "--- /dev/null", `+++ b/${filePath}`, "@@ -0,0 +1,10 @@", ...lines.map((line) => `+${line}`), ""].join("\n"));
}

for (const [tool, output] of Object.entries(recordedOutput)) {
  test(`a ${tool} warning on an added line reaches the review as a diagnostic`, async () => {
    const filePath = changedFiles[tool] ?? "";
    const root = await mkdtemp(path.join(os.tmpdir(), "shadowclone-linter-"));
    const bin = path.join(root, ".bin");
    const previousPath = process.env.PATH;

    await mkdir(path.dirname(path.join(root, filePath)), { recursive: true });
    await writeFile(path.join(root, filePath), "line\n");
    await mkdir(bin);
    await writeFile(path.join(bin, tool), `#!/bin/sh\ncat <<'EOF'\n${output}\nEOF\nexit 1\n`, { mode: 0o755 });
    process.env.PATH = `${bin}:/usr/bin:/bin`;

    try {
      const project = stackProjects({ stacks: allStacks, root, changedFiles: [filePath] }).find(({ stack }) => stack.commands.some((command) => command.tool === tool));

      expect(project).toBeDefined();

      const reports = project === undefined ? [] : await runStack({ ...project, head: { root, roots: [root] }, base: async () => ({ root, roots: [root] }), files: addedFile(filePath), onProgress: () => {}, budget: { deadline: Date.now() + 60_000, environment: {} } });
      const report = reports.find((entry) => entry.tool === tool);

      expect(report?.status).toBe("ran");
      expect(report?.diagnostics.map((diagnostic) => diagnostic.path)).toEqual([filePath]);
    } finally {
      process.env.PATH = previousPath;
    }
  });
}
