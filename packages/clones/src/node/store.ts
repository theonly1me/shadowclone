import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { ownedDirectory, ownedWrite } from "@shadowclone/core";
import { z } from "zod";
import type { ClonesPaths } from "../config/store";
import { cloneStates } from "./progress";
import { cloneIdPattern, cloneRequestSchema, type CloneRequest } from "./request";

export const maximumEvents = 50;

const eventSchema = z.strictObject({
  at: z.string(),
  state: z.enum(cloneStates),
  detail: z.string(),
});

export const cloneRecordSchema = z.strictObject({
  state: z.enum(cloneStates),
  branch: z.string().nullable(),
  pull: z.number().int().positive().nullable(),
  engine: z.enum(["claude", "codex"]).nullable(),
  startedAt: z.string().nullable(),
  updatedAt: z.string(),
  detail: z.string(),
  events: z.array(eventSchema).max(maximumEvents),
});

export type CloneRecord = z.infer<typeof cloneRecordSchema>;

export type StoredRun = {
  readonly request: CloneRequest;
  readonly record: CloneRecord | null;
  readonly stopRequested: boolean;
};

export function runDirectory(options: { readonly paths: ClonesPaths; readonly id: string }): string {
  if (!cloneIdPattern.test(options.id)) {
    throw new Error(`${options.id} is not a clone id.`);
  }

  return path.join(options.paths.runsDirectory, options.id);
}

export function containerLog(options: { readonly paths: ClonesPaths; readonly id: string }): string {
  return path.join(runDirectory(options), "container.log");
}

function errorCode(error: unknown): string | null {
  return error instanceof Error && "code" in error && typeof error.code === "string"
    ? error.code
    : null;
}

export async function createRun(options: {
  readonly paths: ClonesPaths;
  readonly request: CloneRequest;
}): Promise<"created" | "exists"> {
  const directory = runDirectory({ paths: options.paths, id: options.request.id });

  await ownedDirectory(options.paths.runsDirectory);

  try {
    await mkdir(directory, { mode: 0o700 });
  } catch (error) {
    if (errorCode(error) === "EEXIST") {
      return "exists";
    }

    throw error;
  }

  await ownedWrite({
    path: path.join(directory, "request.json"),
    content: `${JSON.stringify(cloneRequestSchema.parse(options.request), null, 2)}\n`,
  });

  return "created";
}

export async function readRun(options: {
  readonly paths: ClonesPaths;
  readonly id: string;
}): Promise<StoredRun | null> {
  const directory = runDirectory(options);
  const requestFile = Bun.file(path.join(directory, "request.json"));

  if (!(await requestFile.exists())) {
    return null;
  }

  const request = cloneRequestSchema.safeParse(await requestFile.json().catch(() => null));

  if (!request.success) {
    return null;
  }

  const recordFile = Bun.file(path.join(directory, "record.json"));
  const record = (await recordFile.exists())
    ? cloneRecordSchema.parse(await recordFile.json())
    : null;

  return {
    request: request.data,
    record,
    stopRequested: await Bun.file(path.join(directory, "stop")).exists(),
  };
}

export async function listRuns(paths: ClonesPaths): Promise<{
  readonly runs: readonly StoredRun[];
  readonly unreadable: readonly string[];
}> {
  const names = await readdir(paths.runsDirectory).catch(() => []);
  const runs: StoredRun[] = [];
  const unreadable: string[] = [];

  for (const name of names.filter((entry) => cloneIdPattern.test(entry)).sort()) {
    const run = await readRun({ paths, id: name }).catch(() => null);

    if (run === null) {
      unreadable.push(name);
    } else {
      runs.push(run);
    }
  }

  return { runs, unreadable };
}

export async function writeRecord(options: {
  readonly paths: ClonesPaths;
  readonly id: string;
  readonly record: CloneRecord;
}): Promise<void> {
  await ownedWrite({
    path: path.join(runDirectory(options), "record.json"),
    content: `${JSON.stringify(cloneRecordSchema.parse(options.record), null, 2)}\n`,
  });
}

export async function writeStopMarker(options: {
  readonly paths: ClonesPaths;
  readonly id: string;
  readonly now: Date;
}): Promise<void> {
  await ownedWrite({
    path: path.join(runDirectory(options), "stop"),
    content: `${options.now.toISOString()}\n`,
  });
}

export async function removeRun(options: {
  readonly paths: ClonesPaths;
  readonly id: string;
}): Promise<void> {
  await rm(runDirectory(options), { recursive: true, force: true });
}
