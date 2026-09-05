#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const packageDirectory = path.dirname(
  path.dirname(fileURLToPath(import.meta.url)),
);

function platformPackage() {
  const platform = process.platform === "win32" ? "windows" : process.platform;
  const architecture = process.arch === "x64" ? "x64" : process.arch;
  return `@theonly1me/shadowclone-${platform}-${architecture}`;
}

function binaryPath() {
  try {
    const manifest = require.resolve(`${platformPackage()}/package.json`);
    const candidate = path.join(path.dirname(manifest), "bin", "shadowclone");
    return existsSync(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function bundlePath() {
  const candidate = path.join(packageDirectory, "dist", "shadowclone.js");
  return existsSync(candidate) ? candidate : null;
}

function run(command, commandArguments) {
  const result = spawnSync(command, commandArguments, { stdio: "inherit" });
  if (result.error) {
    console.error(`shadowclone: could not start ${command}`);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

const binary = binaryPath();
if (binary) {
  run(binary, process.argv.slice(2));
}

const bundle = bundlePath();
if (bundle && spawnSync("bun", ["--version"], { stdio: "ignore" }).status === 0) {
  run("bun", [bundle, ...process.argv.slice(2)]);
}

console.error(
  `shadowclone: no prebuilt binary for ${process.platform}-${process.arch}, and bun was not found on PATH.`,
);
console.error(
  "Install bun from https://bun.sh, or download a release from https://github.com/theonly1me/shadowclone/releases",
);
process.exit(1);
