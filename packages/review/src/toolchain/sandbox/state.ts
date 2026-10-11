import { existsSync, realpathSync } from "node:fs";
import { mkdir, mkdtemp, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export async function sandboxState(options: {
  readonly workspace: string;
  readonly stateDirectory?: string;
}) {
  const key = new Bun.CryptoHasher("sha256").update(options.workspace).digest("hex").slice(0, 24);
  const directory =
    options.stateDirectory === undefined
      ? await mkdtemp(path.join(os.tmpdir(), "shadowclone-tool-state-"))
      : path.join(options.stateDirectory, key);

  await mkdir(directory, { recursive: true, mode: 0o700 });
  const root = await realpath(directory);

  for (const name of ["home", "temporary", "cache", "configuration", "data", "cargo-target"]) {
    await mkdir(path.join(root, name), { recursive: true, mode: 0o700 });
  }

  return { directory: root, disposable: options.stateDirectory === undefined };
}

export function isolatedEnvironment(options: {
  readonly source: Readonly<Record<string, string>>;
  readonly state: string;
}): Record<string, string> {
  const home = path.join(options.state, "home");
  const cache = path.join(options.state, "cache");
  return {
    ...options.source,
    PATH: (options.source.PATH ?? "")
      .split(path.delimiter)
      .map((directory) =>
        directory !== "" && existsSync(directory) ? realpathSync(directory) : directory,
      )
      .join(path.delimiter),
    HOME: home,
    USER: "shadowclone",
    LOGNAME: "shadowclone",
    SHELL: "/bin/sh",
    TMPDIR: path.join(options.state, "temporary"),
    XDG_CACHE_HOME: cache,
    XDG_CONFIG_HOME: path.join(options.state, "configuration"),
    XDG_DATA_HOME: path.join(options.state, "data"),
    BUN_INSTALL: path.join(home, ".bun"),
    BUN_INSTALL_CACHE_DIR: path.join(cache, "bun"),
    npm_config_cache: path.join(cache, "npm"),
    npm_config_userconfig: path.join(home, ".npmrc"),
    npm_config_globalconfig: path.join(home, "global-npmrc"),
    npm_config_script_shell: "/bin/sh",
    COREPACK_HOME: path.join(cache, "corepack"),
    PNPM_HOME: path.join(home, "pnpm"),
    YARN_CACHE_FOLDER: path.join(cache, "yarn"),
    GOPATH: path.join(home, "go"),
    GOMODCACHE: path.join(cache, "go-mod"),
    GOCACHE: path.join(cache, "go-build"),
    CARGO_HOME: path.join(home, "cargo"),
    CARGO_TARGET_DIR: path.join(options.state, "cargo-target"),
    RUSTUP_HOME: options.source.RUSTUP_HOME ?? path.join(os.homedir(), ".rustup"),
    GRADLE_USER_HOME: path.join(home, "gradle"),
    DOTNET_CLI_HOME: home,
    NUGET_PACKAGES: path.join(cache, "nuget"),
    PYTHONNOUSERSITE: "1",
    OPENSSL_CONF: "/dev/null",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_SYSTEM: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
  };
}
