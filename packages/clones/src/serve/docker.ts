import { closeSync, openSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { SessionConfig } from "../session/config";
import type { ClonesPaths } from "../session/store";
import { codexLoginHomeVariable } from "../run/codexHome";
import type { SessionEvent } from "../trigger/event";

export const codexLoginVolume = "shadowclone-codex-login";
export const codexLoginMount = "/home/clone/.codex-login";

export function codexLoginArguments(config: SessionConfig): readonly string[] {
  return config.provider === "chatgpt-subscription"
    ? [
        "--volume",
        `${codexLoginVolume}:${codexLoginMount}`,
        "--env",
        `${codexLoginHomeVariable}=${codexLoginMount}`,
      ]
    : [];
}

export function dockerRunArguments(options: {
  readonly config: SessionConfig;
  readonly paths: ClonesPaths;
  readonly name: string;
  readonly command: readonly string[];
  readonly environment: Readonly<Record<string, string>>;
}): readonly string[] {
  return [
    "docker",
    "run",
    "--rm",
    "--init",
    "--name",
    options.name,
    "--label",
    "dev.shadowclone.session=1",
    "--add-host",
    "host.docker.internal:host-gateway",
    "--env-file",
    options.paths.secretsFile,
    ...Object.entries(options.environment).flatMap(([name, value]) => [
      "--env",
      `${name}=${value}`,
    ]),
    ...codexLoginArguments(options.config),
    options.config.image,
    ...options.command,
  ];
}

export function sessionContainerName(options: {
  readonly config: SessionConfig;
  readonly now: Date;
}): string {
  const stamp = options.now
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14);

  return `shadowclone-${options.config.repository.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}-${stamp}`;
}

export type Launch = (options: {
  readonly config: SessionConfig;
  readonly event: SessionEvent;
}) => Promise<number>;

export function dockerLauncher(options: {
  readonly paths: ClonesPaths;
  readonly now: () => Date;
}): Launch {
  return async ({ config, event }) => {
    const name = sessionContainerName({ config, now: options.now() });
    const log = path.join(options.paths.logsDirectory, `${name}.log`);

    await mkdir(options.paths.logsDirectory, { recursive: true, mode: 0o700 });

    const descriptor = openSync(log, "a", 0o600);
    const child = Bun.spawn({
      cmd: [
        ...dockerRunArguments({
          config,
          paths: options.paths,
          name,
          command: ["shadowclone", "session", "run"],
          environment: {
            SHADOWCLONE_SESSION_CONFIG: JSON.stringify(config),
            SHADOWCLONE_SESSION_EVENT: JSON.stringify(event),
          },
        }),
      ],
      stdin: "ignore",
      stdout: descriptor,
      stderr: descriptor,
    });

    try {
      return await child.exited;
    } finally {
      closeSync(descriptor);
    }
  };
}
