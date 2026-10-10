import { expect, test } from "bun:test";
import { copyFile, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const launcher = path.join(import.meta.dir, "..", "bin", "shadowclone.mjs");

async function installedPackage(placeholderBun: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "shadowclone-launcher-"));
  const bunPackage = path.join(root, "node_modules", "bun");

  await mkdir(path.join(root, "bin"), { recursive: true });
  await mkdir(path.join(root, "dist"), { recursive: true });
  await mkdir(path.join(bunPackage, "bin"), { recursive: true });
  await copyFile(launcher, path.join(root, "bin", "shadowclone.mjs"));
  await writeFile(path.join(root, "dist", "shadowclone.js"), 'console.log("ran with bun");\n');
  await writeFile(
    path.join(bunPackage, "package.json"),
    JSON.stringify({ name: "bun", bin: { bun: "bin/bun.exe" } }),
  );
  await writeFile(path.join(bunPackage, "bin", "bun.exe"), placeholderBun, { mode: 0o755 });
  return root;
}

test("the launcher uses bun on the PATH when an install with --ignore-scripts left the bundled bun as a placeholder", async () => {
  const root = await installedPackage(
    '#!/bin/sh\necho "Error: Bun\'s postinstall script was not run." >&2\nexit 1\n',
  );
  const result = Bun.spawnSync(["node", path.join(root, "bin", "shadowclone.mjs")], {
    env: { ...process.env, PATH: `${path.dirname(process.execPath)}:${process.env.PATH ?? ""}` },
  });

  expect(result.stdout.toString()).toBe("ran with bun\n");
  expect(result.exitCode).toBe(0);
});
