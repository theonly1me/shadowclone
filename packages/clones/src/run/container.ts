import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { cloneConfigSchema, type CloneConfig } from "../config/config";
import { githubThroughGh } from "../github";
import { progressLine, type Progress } from "../node/progress";
import { cloneRequestSchema } from "../node/request";
import { runContainerCheck, type CheckLine } from "../setup/check";
import { runClone } from ".";
import { hostProcesses } from "./processes";

export const cloneMinutes = 170;

export const cloneConfigVariable = "SHADOWCLONE_CLONE_CONFIG";

export const cloneRequestVariable = "SHADOWCLONE_CLONE_REQUEST";

type Environment = Readonly<Record<string, string | undefined>>;

async function* standardInputLines(): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let pending = "";

  for await (const chunk of Bun.stdin.stream()) {
    pending += decoder.decode(chunk, { stream: true });

    const lines = pending.split("\n");

    pending = lines.pop() ?? "";
    yield* lines;
  }
}

function configFromEnvironment(environment: Environment): CloneConfig {
  return cloneConfigSchema.parse(JSON.parse(environment[cloneConfigVariable] ?? "null"));
}

export async function runContainerClone(options: {
  readonly environment: Environment;
  readonly signal: AbortSignal;
}): Promise<Progress> {
  const request = cloneRequestSchema.parse(
    JSON.parse(options.environment[cloneRequestVariable] ?? "null"),
  );

  return runClone({
    config: configFromEnvironment(options.environment),
    request,
    github: githubThroughGh,
    processes: hostProcesses,
    root: await mkdtemp(path.join(os.tmpdir(), "shadowclone-clone-")),
    environment: options.environment,
    signal: AbortSignal.any([options.signal, AbortSignal.timeout(cloneMinutes * 60_000)]),
    inbox: standardInputLines(),
    report: (progress) => {
      process.stdout.write(`${progressLine(progress)}\n`);
    },
  });
}

export async function runContainerCheckFromEnvironment(
  environment: Environment,
): Promise<readonly CheckLine[]> {
  return runContainerCheck({
    config: configFromEnvironment(environment),
    github: githubThroughGh,
    processes: hostProcesses,
    root: await mkdtemp(path.join(os.tmpdir(), "shadowclone-check-")),
    environment,
  });
}
