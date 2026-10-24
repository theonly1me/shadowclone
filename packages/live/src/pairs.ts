import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { z } from "zod";
import type { LivePaths } from "./paths";
import { liveIdPattern, pairIdPattern } from "./record";
import { readRecord } from "./store";

export const pairNoteLimit = 20;

const pairSideSchema = z.object({
  session: z.string().regex(liveIdPattern),
  keyHash: z.string().regex(/^[0-9a-f]{64}$/),
});

const pairSchema = z.object({
  id: z.string().regex(pairIdPattern),
  sides: z.tuple([pairSideSchema, pairSideSchema]),
  createdAt: z.string(),
  sent: z.number().int().nonnegative(),
});

const pairsFileSchema = z.object({ pairs: z.array(pairSchema) });

export type LivePair = z.infer<typeof pairSchema>;

export function newPairId(): string {
  return `pair-${randomBytes(4).toString("hex")}`;
}

export function newPeerKey(): string {
  return randomBytes(16).toString("hex");
}

export function peerKeyHash(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

async function readPairs(paths: LivePaths): Promise<readonly LivePair[]> {
  const text = await readFile(paths.pairsFile, "utf8").catch(() => null);
  const parsed = text === null ? null : pairsFileSchema.safeParse(parseJson(text));

  return parsed?.success === true ? parsed.data.pairs : [];
}

export async function writePairs(options: {
  readonly paths: LivePaths;
  readonly pairs: readonly LivePair[];
}): Promise<void> {
  const { paths } = options;
  const temporary = `${paths.pairsFile}.${randomUUID()}.tmp`;

  await mkdir(paths.directory, { recursive: true, mode: 0o700 });
  await writeFile(temporary, `${JSON.stringify({ pairs: options.pairs })}\n`, { mode: 0o600 });
  await rename(temporary, paths.pairsFile);
}

async function sessionIsOpen(options: {
  readonly paths: LivePaths;
  readonly id: string;
}): Promise<boolean> {
  const record = await readRecord(options);

  return record !== null && record.state !== "ended";
}

export async function activePairs(paths: LivePaths): Promise<readonly LivePair[]> {
  const pairs = await readPairs(paths);
  const active: LivePair[] = [];

  for (const pair of pairs) {
    const [first, second] = pair.sides;

    if (
      (await sessionIsOpen({ paths, id: first.session })) &&
      (await sessionIsOpen({ paths, id: second.session }))
    ) {
      active.push(pair);
    }
  }

  if (active.length !== pairs.length) {
    await writePairs({ paths, pairs: active });
  }

  return active;
}

export async function removePair(options: {
  readonly paths: LivePaths;
  readonly id: string;
}): Promise<boolean> {
  const pairs = await readPairs(options.paths);
  const kept = pairs.filter((pair) => pair.id !== options.id);

  if (kept.length !== pairs.length) {
    await writePairs({ paths: options.paths, pairs: kept });
  }

  return kept.length !== pairs.length;
}
