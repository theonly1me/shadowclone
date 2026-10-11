import path from "node:path";
import type { SandboxRuntimeConfig } from "@anthropic-ai/sandbox-runtime";

const publicRegistries = [
  "registry.npmjs.org:443",
  "registry.yarnpkg.com:443",
  "pypi.org:443",
  "files.pythonhosted.org:443",
  "proxy.golang.org:443",
  "sum.golang.org:443",
  "index.crates.io:443",
  "static.crates.io:443",
  "crates.io:443",
  "repo.maven.apache.org:443",
  "repo1.maven.org:443",
  "plugins.gradle.org:443",
  "plugins-artifacts.gradle.org:443",
  "services.gradle.org:443",
  "downloads.gradle.org:443",
  "api.nuget.org:443",
  "globalcdn.nuget.org:443",
];

export function sandboxPolicy(options: {
  readonly workspace: string;
  readonly state: string;
  readonly runtimePaths: readonly string[];
  readonly environment: Readonly<Record<string, string>>;
}): SandboxRuntimeConfig {
  const sdk = path.dirname(
    Bun.resolveSync("@anthropic-ai/sandbox-runtime/package.json", import.meta.dir),
  );
  return {
    credentials: {
      envVars: Object.keys(process.env)
        .filter((name) => !Object.hasOwn(options.environment, name))
        .map((name) => ({ name, mode: "deny" as const })),
    },
    network: {
      allowedDomains: publicRegistries,
      deniedDomains: [],
      strictAllowlist: true,
      allowUnixSockets: [],
      allowAllUnixSockets: false,
      allowLocalBinding: false,
    },
    filesystem: {
      denyRead: [{ path: "/", literal: true }],
      allowRead: [options.workspace, options.state, ...options.runtimePaths].map((file) => ({
        path: file,
        literal: true,
      })),
      allowWrite: [options.workspace, options.state].map((directory) => ({
        path: directory,
        literal: true,
      })),
      denyWrite: ["/tmp/claude", "/private/tmp/claude"].map((directory) => ({
        path: directory,
        literal: true,
      })),
      allowGitConfig: false,
    },
    seccomp: { applyPath: path.join(sdk, "vendor/seccomp", process.arch, "apply-seccomp") },
    enableWeakerNestedSandbox: false,
    enableWeakerNetworkIsolation: false,
    allowAppleEvents: false,
  };
}
