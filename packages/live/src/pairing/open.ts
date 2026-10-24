import type { LivePaths } from "../paths";
import type { LiveRecord } from "../record";
import { readRecord } from "../store";
import type { Refused } from "./types";

export function refused(reason: string): Refused {
  return { kind: "refused", reason };
}

export async function openRecord(options: {
  readonly paths: LivePaths;
  readonly id: string;
}): Promise<{ readonly kind: "open"; readonly record: LiveRecord } | Refused> {
  const record = await readRecord(options);

  if (record === null) {
    return refused(`No live session ${options.id} exists on this machine.`);
  }

  return record.state === "ended"
    ? refused(`Live session ${options.id} already ended.`)
    : { kind: "open", record };
}

