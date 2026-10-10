import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { toolEnvironment } from "./process";

function binDirectory(executables: readonly string[]): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), "shadowclone-bin-"));

  for (const executable of executables) {
    writeFileSync(path.join(directory, executable), `#!/bin/sh\necho "${executable} $*"\n`, { mode: 0o755 });
  }

  return directory;
}

function run(options: { readonly executable: string; readonly environment: Record<string, string> }): string {
  const result = Bun.spawnSync({ cmd: [options.executable, "install", "--frozen-lockfile"], env: options.environment });

  return result.stdout.toString().trim();
}

test("a pnpm repository installs through Corepack when pnpm itself is not installed", () => {
  const bin = binDirectory(["corepack"]);

  try {
    const environment = toolEnvironment({ PATH: `${bin}:/usr/bin:/bin` });

    expect(run({ executable: "pnpm", environment })).toBe("corepack pnpm install --frozen-lockfile");
    expect(run({ executable: "yarn", environment })).toBe("corepack yarn install --frozen-lockfile");
    expect(environment.COREPACK_ENABLE_DOWNLOAD_PROMPT).toBe("0");
  } finally {
    rmSync(bin, { recursive: true, force: true });
  }
});

test("an installed pnpm runs as it is, without Corepack", () => {
  const bin = binDirectory(["corepack", "pnpm", "yarn"]);

  try {
    const environment = toolEnvironment({ PATH: `${bin}:/usr/bin:/bin` });

    expect(environment.PATH).toBe(`${bin}:/usr/bin:/bin`);
    expect(run({ executable: "pnpm", environment })).toBe("pnpm install --frozen-lockfile");
  } finally {
    rmSync(bin, { recursive: true, force: true });
  }
});
