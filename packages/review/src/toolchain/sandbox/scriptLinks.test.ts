import { expect, test } from "bun:test";
import { chmod, copyFile, mkdir, mkdtemp, realpath, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runTool, toolEnvironment } from "../process";

for (const manager of ["npm", "pnpm"]) {
  test(`${manager} reads installed modules through its CLI script links`, async () => {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "shadowclone-script-link-")));
    const workspace = path.join(root, "work");
    const bin = path.join(root, "bin");
    const executable = manager === "npm" ? "npm" : "corepack";
    const installation = path.join(root, "lib/node_modules", executable, "bin");
    await mkdir(workspace);
    await mkdir(bin);
    await mkdir(installation, { recursive: true });
    const script = path.join(installation, "entry.js");
    await Bun.write(script, '#!/usr/bin/env node\nrequire("./runtime.js");\n');
    await Bun.write(
      path.join(installation, "runtime.js"),
      'console.log("synthetic " + process.argv.slice(2).join(":"));\n',
    );
    await chmod(script, 0o755);
    await symlink(path.relative(bin, script), path.join(bin, executable));
    const node = Bun.which("node");
    if (node === null) {
      throw new Error("The script-link fixture needs Node");
    }
    await copyFile(node, path.join(bin, "node"));

    try {
      const result = await runTool({
        arguments: [manager, "--version"],
        cwd: workspace,
        environment: toolEnvironment({ PATH: `${bin}:/usr/bin:/bin` }),
        timeoutMilliseconds: 10_000,
      });
      expect(result).toMatchObject({
        kind: "finished",
        exitCode: 0,
        output: manager === "npm" ? "synthetic --version\n\n" : "synthetic pnpm:--version\n\n",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}
