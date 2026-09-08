import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { ProfileRule } from "../profile";
import { profileRuleSchema } from "../profile/metadata";
import type { DistillBatch } from "./batch";

export function checkpointId(batch: DistillBatch): string {
  const identity = batch.signals.map((signal) => ({
    kind: signal.kind,
    sessionId: signal.sessionId,
    timestamp: signal.timestamp,
    refs: signal.textRefs,
  }));
  return new Bun.CryptoHasher("sha256")
    .update(`${batch.origin.id}:${JSON.stringify(identity)}`)
    .digest("hex")
    .slice(0, 24);
}

export async function readCheckpoint(options: {
  readonly checkpointDirectory: string;
  readonly batch: DistillBatch;
}): Promise<readonly ProfileRule[] | null> {
  const file = Bun.file(
    path.join(options.checkpointDirectory, `${checkpointId(options.batch)}.json`),
  );
  if (!(await file.exists())) {
    return null;
  }
  const value: unknown = await file.json();
  return Array.isArray(value) ? value.filter(isProfileRule) : null;
}

function isProfileRule(value: unknown): value is ProfileRule {
  return profileRuleSchema.safeParse(value).success;
}

export async function writeCheckpoint(options: {
  readonly checkpointDirectory: string;
  readonly batch: DistillBatch;
  readonly rules: readonly ProfileRule[];
}): Promise<void> {
  await mkdir(options.checkpointDirectory, { recursive: true });
  await Bun.write(
    path.join(options.checkpointDirectory, `${checkpointId(options.batch)}.json`),
    `${JSON.stringify(options.rules, null, 2)}\n`,
  );
}
