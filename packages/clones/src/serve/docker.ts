import { closeSync, openSync, writeSync } from "node:fs";
import type { CloneConfig } from "../config/config";
import type { ClonesPaths } from "../config/store";
import { parseProgressLine, type Progress } from "../node/progress";
import type { CloneRequest } from "../node/request";
import { containerLog } from "../node/store";
import { codexLoginHomeVariable } from "../run/codexHome";
import { cloneConfigVariable, cloneRequestVariable } from "../run/container";

export const codexLoginVolume = "shadowclone-codex-login";
export const codexLoginMount = "/home/clone/.codex-login";

export function codexLoginArguments(config: CloneConfig): readonly string[] {
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
  readonly config: CloneConfig;
  readonly paths: ClonesPaths;
  readonly name: string;
  readonly label: string;
  readonly command: readonly string[];
  readonly environment: Readonly<Record<string, string>>;
  readonly interactive?: boolean;
}): readonly string[] {
  return [
    "docker",
    "run",
    "--rm",
    "--init",
    ...(options.interactive === true ? ["--interactive"] : []),
    "--name",
    options.name,
    "--label",
    options.label,
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

export type Launch = (options: {
  readonly config: CloneConfig;
  readonly request: CloneRequest;
  readonly signal: AbortSignal;
  readonly onProgress: (progress: Progress) => Promise<void>;
  readonly attach: (send: (line: string) => void) => void;
}) => Promise<number>;

async function relayOutput(options: {
  readonly stream: ReadableStream<Uint8Array>;
  readonly descriptor: number;
  readonly onProgress: (progress: Progress) => Promise<void>;
}): Promise<void> {
  const decoder = new TextDecoder();
  let pending = "";

  for await (const chunk of options.stream) {
    writeSync(options.descriptor, chunk);
    pending += decoder.decode(chunk, { stream: true });

    const lines = pending.split("\n");

    pending = lines.pop() ?? "";

    for (const line of lines) {
      const progress = parseProgressLine(line);

      if (progress !== null) {
        await options.onProgress(progress);
      }
    }
  }

  const last = parseProgressLine(pending);

  if (last !== null) {
    await options.onProgress(last);
  }
}

export function dockerLauncher(options: { readonly paths: ClonesPaths }): Launch {
  return async ({ config, request, signal, onProgress, attach }) => {
    const descriptor = openSync(containerLog({ paths: options.paths, id: request.id }), "a", 0o600);
    const child = Bun.spawn({
      cmd: [
        ...dockerRunArguments({
          config,
          paths: options.paths,
          name: `shadowclone-${request.id}`,
          label: `dev.shadowclone.clone=${request.id}`,
          command: ["shadowclone", "clone", "run"],
          interactive: true,
          environment: {
            [cloneConfigVariable]: JSON.stringify(config),
            [cloneRequestVariable]: JSON.stringify(request),
          },
        }),
      ],
      stdin: "pipe",
      stdout: "pipe",
      stderr: descriptor,
    });

    attach((line) => {
      child.stdin.write(`${line}\n`);
      child.stdin.flush();
    });
    const stop = () => child.kill("SIGTERM");

    signal.addEventListener("abort", stop, { once: true });

    if (signal.aborted) {
      stop();
    }

    try {
      await relayOutput({ stream: child.stdout, descriptor, onProgress });

      return await child.exited;
    } finally {
      signal.removeEventListener("abort", stop);
      closeSync(descriptor);
    }
  };
}
