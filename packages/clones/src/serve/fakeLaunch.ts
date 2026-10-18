import type { ClonesPaths } from "../config/store";
import type { Progress } from "../node/progress";
import type { CloneRequest } from "../node/request";
import type { Running, ServeContext } from "./clone";
import type { Launch } from "./docker";

export type StartedClone = {
  readonly request: CloneRequest;
  readonly signal: AbortSignal;
  readonly onProgress: (progress: Progress) => Promise<void>;
  readonly finish: (exitCode: number) => void;
};

export function fakeLaunch(): { readonly launch: Launch; readonly started: StartedClone[] } {
  const started: StartedClone[] = [];
  const launch: Launch = (options) =>
    new Promise<number>((resolve) => {
      started.push({ ...options, finish: resolve });
    });

  return { launch, started };
}

export async function until(condition: () => boolean | Promise<boolean>): Promise<void> {
  for (let attempt = 0; attempt < 400; attempt++) {
    if (await condition()) {
      return;
    }

    await Bun.sleep(5);
  }

  throw new Error("The condition did not become true within 2 seconds.");
}

export function serveContext(options: {
  readonly paths: ClonesPaths;
  readonly launch: Launch;
}): ServeContext & { readonly lines: string[]; readonly running: Map<string, Running> } {
  const lines: string[] = [];

  return {
    paths: options.paths,
    launch: options.launch,
    now: () => new Date(),
    log: (line) => lines.push(line),
    lines,
    running: new Map(),
  };
}

export async function settle(running: Map<string, Running>): Promise<void> {
  await Promise.all([...running.values()].map((entry) => entry.done));
}
