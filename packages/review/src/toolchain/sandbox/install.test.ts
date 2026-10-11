import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runStack } from "../stackRun";
import { javascriptStack } from "../stacks/javascript";

test("nested JavaScript installs and checks use isolated state and keep lifecycle scripts disabled", async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "shadowclone-install-")));
  const workspace = path.join(root, "work");
  const project = path.join(workspace, "project");
  const dependency = path.join(workspace, "dependency");
  const stateDirectory = path.join(root, "state");
  await mkdir(project, { recursive: true });
  await mkdir(dependency);
  await Bun.write(path.join(workspace, "shared.txt"), "synthetic shared source");
  await Bun.write(
    path.join(dependency, "package.json"),
    JSON.stringify({
      name: "synthetic-dependency",
      version: "1.0.0",
      scripts: {
        postinstall: "node -e \"require('fs').writeFileSync('../lifecycle-ran', 'unsafe')\"",
      },
    }),
  );
  await Bun.write(
    path.join(project, "package.json"),
    JSON.stringify({
      name: "synthetic-project",
      version: "1.0.0",
      dependencies: { "synthetic-dependency": "file:../dependency" },
      scripts: {
        typecheck: "node check.js",
        postinstall: "node -e \"require('fs').writeFileSync('lifecycle-ran', 'unsafe')\"",
      },
    }),
  );
  await Bun.write(
    path.join(project, "check.js"),
    [
      'const fs = require("node:fs");',
      'fs.writeFileSync("result.json", JSON.stringify({ shared: fs.readFileSync("../shared.txt", "utf8"), home: process.env.HOME, cache: process.env.npm_config_cache, temporary: process.env.TMPDIR }));',
    ].join("\n"),
  );
  const head = { root: workspace, roots: [workspace] };

  try {
    const [report] = await runStack({
      stack: javascriptStack,
      directory: "project",
      head,
      base: async () => head,
      files: [],
      onProgress: () => {},
      budget: { deadline: Date.now() + 20_000, environment: {}, stateDirectory },
    });
    expect(report).toMatchObject({ tool: "typecheck", status: "ran", diagnostics: [] });
    expect(existsSync(path.join(project, "node_modules/synthetic-dependency/package.json"))).toBe(
      true,
    );
    expect(existsSync(path.join(project, "lifecycle-ran"))).toBe(false);
    expect(existsSync(path.join(workspace, "lifecycle-ran"))).toBe(false);
    const observed: unknown = await Bun.file(path.join(project, "result.json")).json();
    expect(observed).toEqual({
      shared: "synthetic shared source",
      home: expect.stringMatching(new RegExp(`^${stateDirectory}/[^/]+/home$`)),
      cache: expect.stringMatching(new RegExp(`^${stateDirectory}/[^/]+/cache/npm$`)),
      temporary: expect.stringMatching(new RegExp(`^${stateDirectory}/[^/]+/temporary$`)),
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 30_000);
