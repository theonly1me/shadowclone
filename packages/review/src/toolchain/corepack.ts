import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const corepackManagers = ["pnpm", "yarn"] as const;

const shimDirectories = new Map<string, string>();

function shellQuoted(text: string): string {
  return `'${text.replaceAll("'", `'\\''`)}'`;
}

function shimDirectory(options: { readonly corepack: string; readonly managers: readonly string[] }): string {
  const key = `${options.corepack}\n${options.managers.join(",")}`;
  const known = shimDirectories.get(key);

  if (known !== undefined) {
    return known;
  }

  const directory = mkdtempSync(path.join(os.tmpdir(), "shadowclone-corepack-"));

  for (const manager of options.managers) {
    writeFileSync(path.join(directory, manager), `#!/bin/sh\nexec ${shellQuoted(options.corepack)} ${manager} "$@"\n`, { mode: 0o755 });
  }

  shimDirectories.set(key, directory);
  return directory;
}

export function withCorepackManagers(environment: Readonly<Record<string, string>>): Record<string, string> {
  const searchPath = environment.PATH ?? "";
  const corepack = process.platform === "win32" ? null : Bun.which("corepack", { PATH: searchPath });
  const missing = corepackManagers.filter((manager) => Bun.which(manager, { PATH: searchPath }) === null);

  if (corepack === null || missing.length === 0) {
    return { ...environment };
  }

  return {
    ...environment,
    PATH: [shimDirectory({ corepack, managers: missing }), searchPath].filter((entry) => entry !== "").join(path.delimiter),
    COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
  };
}
