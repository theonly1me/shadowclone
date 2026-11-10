import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { LivePaths } from "./paths";

const liveFileKinds = ["record", "inbox", "task", "brief", "briefCalls", "briefLock"] as const;

export type LiveFileKind = (typeof liveFileKinds)[number];

const suffixes: Readonly<Record<LiveFileKind, string>> = {
  record: ".json",
  inbox: ".inbox.jsonl",
  task: ".task.json",
  brief: ".brief.json",
  briefCalls: ".brief-calls.json",
  briefLock: ".brief.lock",
};

const briefFileNamePattern = /^(live-[0-9a-f]{8})\.(?:task\.json|brief\.json|brief-calls\.json|brief\.lock)$/;

export function liveFile(options: {
  readonly paths: LivePaths;
  readonly id: string;
  readonly kind: LiveFileKind;
}): string {
  return path.join(options.paths.directory, `${options.id}${suffixes[options.kind]}`);
}

export async function ensureDirectory(paths: LivePaths): Promise<void> {
  await mkdir(paths.directory, { recursive: true, mode: 0o700 });
}

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export async function readJsonFile(file: string): Promise<unknown> {
  const text = await readFile(file, "utf8").catch(() => null);

  return text === null ? undefined : parseJson(text);
}

export async function writePrivateJson(options: {
  readonly paths: LivePaths;
  readonly file: string;
  readonly value: unknown;
}): Promise<void> {
  await ensureDirectory(options.paths);

  const temporary = `${options.file}.${randomUUID()}.tmp`;

  await writeFile(temporary, `${JSON.stringify(options.value)}\n`, { mode: 0o600 });
  await rename(temporary, options.file).catch(async (error: unknown) => {
    await rm(temporary, { force: true });
    throw error;
  });
}

export async function removeSessionFiles(options: {
  readonly paths: LivePaths;
  readonly id: string;
}): Promise<void> {
  for (const kind of liveFileKinds) {
    await rm(liveFile({ ...options, kind }), { force: true });
  }
}

export async function removeBriefFiles(paths: LivePaths): Promise<number> {
  const names = await readdir(paths.directory).catch(() => []);
  const sessions = new Set<string>();

  for (const name of names) {
    const [, id] = briefFileNamePattern.exec(name) ?? [];

    if (id !== undefined) {
      await rm(path.join(paths.directory, name), { force: true });
      sessions.add(id);
    }
  }

  return sessions.size;
}
