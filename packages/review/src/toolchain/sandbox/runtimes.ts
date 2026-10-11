import { existsSync, realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";

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

function packageRoot(file: string): string | null {
  const marker = `${path.sep}node_modules${path.sep}`;
  const position = file.lastIndexOf(marker);

  if (position < 0) {
    return null;
  }

  const [first, second] = file.slice(position + marker.length).split(path.sep);

  if (first === undefined || (first.startsWith("@") && second === undefined)) {
    return null;
  }

  return path.join(
    file.slice(0, position + marker.length),
    first,
    ...(first.startsWith("@") && second !== undefined ? [second] : []),
  );
}

function executableReadPaths(file: string): readonly string[] {
  const resolved = realpathSync(file);
  const packageDirectory = packageRoot(resolved);
  const runtime = path.dirname(path.dirname(resolved));
  const installedRuntime =
    path.basename(path.dirname(resolved)) === "bin" &&
    ["VERSION", "release", "pyvenv.cfg"].some((name) => existsSync(path.join(runtime, name)));

  return [
    file,
    resolved,
    ...(packageDirectory ? [packageDirectory] : []),
    ...(installedRuntime ? [runtime] : []),
  ];
}

export function runtimeReadPaths(environment: Readonly<Record<string, string>>): readonly string[] {
  const executables = toolNames.flatMap((name) => {
    const file = Bun.which(name, { PATH: environment.PATH ?? "" });
    return file === null ? [] : executableReadPaths(file);
  });
  const rustup = environment.RUSTUP_HOME ?? path.join(os.homedir(), ".rustup");
  const sdk = path.dirname(
    Bun.resolveSync("@anthropic-ai/sandbox-runtime/package.json", import.meta.dir),
  );

  return [
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
}
