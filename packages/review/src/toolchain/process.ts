import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { withCorepackManagers } from "./corepack";
import { runSandboxedTool, type SandboxRun } from "./sandbox";

export type ToolRun = SandboxRun | { readonly kind: "missing"; readonly executable: string };

const passedKeys = [
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "LANG",
  "LC_ALL",
  "TMPDIR",
  "TZ",
  "SSL_CERT_FILE",
  "NODE_EXTRA_CA_CERTS",
  "GOPATH",
  "GOROOT",
  "GOMODCACHE",
  "GOCACHE",
  "CARGO_HOME",
  "RUSTUP_HOME",
  "JAVA_HOME",
  "GRADLE_USER_HOME",
  "MAVEN_HOME",
  "DOTNET_ROOT",
  "NUGET_PACKAGES",
  "PNPM_HOME",
  "COREPACK_HOME",
  "BUN_INSTALL",
  "npm_config_cache",
  "VIRTUAL_ENV",
  "PYENV_ROOT",
] as const;

export function toolEnvironment(
  source: Readonly<Record<string, string | undefined>> = process.env,
): Record<string, string> {
  const environment: Record<string, string> = {
    CI: "1",
    NO_COLOR: "1",
    FORCE_COLOR: "0",
    DOTNET_CLI_TELEMETRY_OPTOUT: "1",
    DOTNET_NOLOGO: "1",
    NEXT_TELEMETRY_DISABLED: "1",
  };

  for (const key of passedKeys) {
    const value = source[key];

    if (value !== undefined) {
      environment[key] = value;
    }
  }

  return withCorepackManagers(environment);
}

export async function runTool(options: {
  readonly arguments: readonly string[];
  readonly cwd: string;
  readonly timeoutMilliseconds: number;
  readonly environment: Readonly<Record<string, string>>;
  readonly workspaceRoot?: string;
  readonly stateDirectory?: string;
}): Promise<ToolRun> {
  const [executable] = options.arguments;
  const environment = { ...toolEnvironment(), ...options.environment };

  if (executable === undefined) {
    throw new Error("A toolchain command needs an executable");
  }

  const located = executable.includes("/")
    ? path.resolve(options.cwd, executable)
    : Bun.which(executable, { PATH: environment.PATH ?? "" });

  if (located === null || !existsSync(located)) {
    return { kind: "missing", executable };
  }

  return runSandboxedTool({
    ...options,
    arguments: [
      path.join(realpathSync(path.dirname(located)), path.basename(located)),
      ...options.arguments.slice(1),
    ],
    environment,
  });
}
