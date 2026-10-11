import { existsSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { executableReadPaths } from "./executables";

const systemReadPaths = [
  "/bin",
  "/sbin",
  "/usr/bin",
  "/usr/sbin",
  "/usr/lib",
  "/usr/lib64",
  "/usr/share",
  "/lib",
  "/lib64",
  "/usr/local/bin",
  "/usr/local/lib",
  "/usr/local/share",
  "/opt/homebrew/bin",
  "/opt/homebrew/lib",
  "/opt/homebrew/opt",
  "/opt/homebrew/Cellar",
  "/System/Library",
  "/Library/Frameworks",
  "/private/var/select/sh",
  "/etc/ssl/cert.pem",
  "/etc/ssl/certs",
  "/etc/pki/tls/certs",
  "/dev/null",
  "/dev/zero",
  "/dev/random",
  "/dev/urandom",
  "/dev/fd",
  "/dev/stdin",
  "/dev/stdout",
  "/dev/stderr",
  "/dev/tty",
  "/proc",
  "/sys/devices/system/cpu",
];

const toolNames = [
  "bun",
  "node",
  "npm",
  "pnpm",
  "yarn",
  "corepack",
  "python",
  "python3",
  "ruff",
  "mypy",
  "pyright",
  "go",
  "gofmt",
  "cargo",
  "rustup",
  "java",
  "javac",
  "mvn",
  "gradle",
  "dotnet",
  "shellcheck",
  "hadolint",
  "actionlint",
  "zizmor",
  "squawk",
  "trivy",
];

export function runtimeReadPaths(environment: Readonly<Record<string, string>>): readonly string[] {
  const executables = toolNames.flatMap((tool) => {
    const file = Bun.which(tool, { PATH: environment.PATH ?? "" });
    return file === null ? [] : executableReadPaths({ file, tool });
  });
  const rustup = environment.RUSTUP_HOME ?? path.join(os.homedir(), ".rustup");
  const sdk = path.dirname(
    Bun.resolveSync("@anthropic-ai/sandbox-runtime/package.json", import.meta.dir),
  );

  const files = [
    ...new Set(
      [
        ...systemReadPaths.filter(existsSync),
        ...executables,
        sdk,
        path.join(rustup, "toolchains"),
        path.join(rustup, "settings.toml"),
      ].filter(existsSync),
    ),
  ];
  const directories = files.filter((file) => statSync(file).isDirectory());
  return files.filter(
    (file) => !directories.some((directory) => file.startsWith(`${directory}${path.sep}`)),
  );
}
