import { expect, test } from "bun:test";
import { mkdir, mkdtemp, realpath, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { SandboxManager } from "@anthropic-ai/sandbox-runtime";
import cliManifest from "../package.json";
import product from "@shadowclone/core/product.json";
import { buildRuntimeBundle } from "./bundle";
import { publishedManifest } from "./publishedManifest";

test("the relocated CLI keeps the sandbox runtime external and finds its native helpers", async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "shadowclone-sandbox-bundle-")));
  const workspace = path.join(root, "work");
  const installed = path.join(root, "installed");
  const entryPoint = path.join(root, "entry.ts");
  const runner = path.resolve(import.meta.dir, "../../review/src/toolchain/process.ts");
  const sdk = path.dirname(
    Bun.resolveSync("@anthropic-ai/sandbox-runtime/package.json", import.meta.dir),
  );
  await mkdir(workspace);
  await mkdir(path.join(installed, "node_modules/@anthropic-ai"), { recursive: true });
  await symlink(sdk, path.join(installed, "node_modules/@anthropic-ai/sandbox-runtime"));
  await Bun.write(
    entryPoint,
    [
      `import { runTool } from ${JSON.stringify(runner)};`,
      'console.log(JSON.stringify(await runTool({ arguments: ["sh", "-c", "printf relocated"], cwd: process.argv[2], environment: {}, timeoutMilliseconds: 10000 })));',
    ].join("\n"),
  );

  try {
    expect((await SandboxManager.checkDependenciesAsync()).errors).toEqual([]);
    const bundle = await buildRuntimeBundle(entryPoint);
    const text = await bundle.text();
    expect(text).toContain("@anthropic-ai/sandbox-runtime");
    expect(text).not.toContain(sdk);
    const manifest = publishedManifest({ cliManifest, product });
    expect(manifest.dependencies["@anthropic-ai/sandbox-runtime"]).toBe("0.0.79");
    const cli = path.join(installed, "cli.js");
    await Bun.write(cli, bundle);
    const run = Bun.spawn([process.execPath, cli, workspace], { stdout: "pipe", stderr: "pipe" });
    const error = await new Response(run.stderr).text();
    expect(error).toBe("");
    expect(await new Response(run.stdout).json()).toEqual({
      kind: "finished",
      exitCode: 0,
      output: "relocated\n",
    });
    expect(await run.exited).toBe(0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 30_000);
