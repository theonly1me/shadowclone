import { z } from "zod";
import { ownedWrite } from "@shadowclone/core";
import type { GithubCall } from "../github";
import type { SessionConfig } from "../session/config";
import { listSessionConfigs, type ClonesPaths } from "../session/store";
import type { SessionEvent } from "../trigger/event";
import type { Launch } from "./docker";
import {
  pollRepository,
  repositoryCursorSchema,
  startingCursor,
  type RepositoryCursor,
} from "./poll";

export const pollMilliseconds = 60_000;

const cursorsSchema = z.record(z.string(), repositoryCursorSchema);

async function readCursors(paths: ClonesPaths): Promise<Record<string, RepositoryCursor>> {
  const file = Bun.file(paths.cursorsFile);

  return (await file.exists()) ? cursorsSchema.parse(await file.json()) : {};
}

export type SessionQueue = {
  readonly add: (options: { readonly config: SessionConfig; readonly event: SessionEvent }) => void;
  readonly idle: () => Promise<void>;
};

export function sessionQueue(options: {
  readonly launch: Launch;
  readonly log: (line: string) => void;
}): SessionQueue {
  let tail: Promise<void> = Promise.resolve();

  return {
    add: (entry) => {
      tail = tail.then(async () => {
        options.log(
          `Starting a session for ${entry.config.repository}: ${JSON.stringify(entry.event)}`,
        );

        try {
          const exitCode = await options.launch(entry);

          options.log(`The session for ${entry.config.repository} exited with code ${exitCode}.`);
        } catch (error) {
          options.log(
            `The session for ${entry.config.repository} could not start: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      });
    },
    idle: () => tail,
  };
}

export async function pollOnce(options: {
  readonly paths: ClonesPaths;
  readonly github: GithubCall;
  readonly queue: SessionQueue;
  readonly now: Date;
  readonly log: (line: string) => void;
}): Promise<number> {
  const cursors = await readCursors(options.paths);
  let queued = 0;

  for (const config of (await listSessionConfigs(options.paths)).filter(
    (entry) => entry.host === "local",
  )) {
    try {
      const result = await pollRepository({
        github: options.github,
        config,
        cursor: cursors[config.repository] ?? startingCursor(options.now),
        now: options.now,
      });

      for (const event of result.events) {
        options.queue.add({ config, event });
        queued++;
      }

      cursors[config.repository] = result.cursor;
    } catch (error) {
      options.log(
        `Polling ${config.repository} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  await ownedWrite({
    path: options.paths.cursorsFile,
    content: `${JSON.stringify(cursors, null, 2)}\n`,
  });

  return queued;
}

export async function serveSessions(options: {
  readonly paths: ClonesPaths;
  readonly github: GithubCall;
  readonly launch: Launch;
  readonly signal: AbortSignal;
  readonly now: () => Date;
  readonly log: (line: string) => void;
}): Promise<void> {
  const queue = sessionQueue(options);

  options.log(`shadowclone serve polls GitHub every ${pollMilliseconds / 1000} seconds.`);

  while (!options.signal.aborted) {
    await pollOnce({ ...options, queue, now: options.now() });
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, pollMilliseconds);

      options.signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });
  }

  await queue.idle();
}
