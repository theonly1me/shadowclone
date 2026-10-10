import { expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseDiff } from "../../collect/diff";
import { stackProjects } from "../projects";
import { runStack } from "../stackRun";
import { allStacks } from ".";

const rootUserCheck = JSON.stringify({
  Results: [
    {
      Target: "Dockerfile",
      Misconfigurations: [
        {
          ID: "DS-0002",
          Severity: "HIGH",
          Title: "Image user should not be 'root'",
          CauseMetadata: { StartLine: null },
        },
      ],
    },
  ],
});

test("trivy reports a check that a new Dockerfile adds, with a file-level check on line 1", async () => {
  const head = await mkdtemp(path.join(os.tmpdir(), "shadowclone-trivy-head-"));
  const base = await mkdtemp(path.join(os.tmpdir(), "shadowclone-trivy-base-"));
  const bin = path.join(head, ".bin");
  const previousPath = process.env.PATH;

  await writeFile(path.join(head, "Dockerfile"), 'FROM node:20\nCMD ["node", "server.js"]\n');
  await mkdir(bin);
  await writeFile(
    path.join(bin, "trivy"),
    `#!/bin/sh\nif [ -f Dockerfile ]; then cat <<'EOF'\n${rootUserCheck}\nEOF\nelse echo '{}'; fi\n`,
    { mode: 0o755 },
  );
  process.env.PATH = `${bin}:/usr/bin:/bin`;

  try {
    const files = parseDiff(
      [
        "diff --git a/Dockerfile b/Dockerfile",
        "new file mode 100644",
        "--- /dev/null",
        "+++ b/Dockerfile",
        "@@ -0,0 +1,2 @@",
        "+FROM node:20",
        '+CMD ["node", "server.js"]',
        "",
      ].join("\n"),
    );
    const project = stackProjects({
      stacks: allStacks,
      root: head,
      changedFiles: ["Dockerfile"],
    }).find(({ stack }) => stack.commands.some((command) => command.tool === "trivy"));
    const reports =
      project === undefined
        ? []
        : await runStack({
            ...project,
            head: { root: head, roots: [head] },
            base: async () => ({ root: base, roots: [base] }),
            files,
            onProgress: () => {},
            budget: { deadline: Date.now() + 60_000, environment: {} },
          });

    expect(reports.find((report) => report.tool === "trivy")?.diagnostics).toEqual([
      {
        tool: "trivy",
        path: "Dockerfile",
        line: 1,
        message: "HIGH DS-0002: Image user should not be 'root'",
        fileLevel: true,
      },
    ]);
  } finally {
    process.env.PATH = previousPath;
  }
});
