import { acquireLocalLock, type EngineId } from "@shadowclone/core";
import {
  briefLockFile,
  briefMessageDigest,
  readBrief,
  readBriefCalls,
  readRecord,
  readTask,
  saveBrief,
  saveBriefCalls,
  type LiveBrief,
  type LivePaths,
} from "@shadowclone/live";
import { briefFromAnswer } from "./answer";
import { engineIdOf, type BriefModel } from "./model";
import { briefAnswerJsonSchema, briefRequest } from "./request";

export const briefCallsPerHour = 12;

export const briefCallMilliseconds = 60_000;

const hourMilliseconds = 3_600_000;

export type BriefSkip = "missing" | "busy" | "no-message" | "unchanged" | "limited" | "engine-not-allowed";

export type BriefOutcome =
  | { readonly kind: "written"; readonly brief: LiveBrief }
  | { readonly kind: "skipped"; readonly reason: BriefSkip }
  | { readonly kind: "failed"; readonly reason: "model" | "invalid" };

type BriefRun = {
  readonly paths: LivePaths;
  readonly id: string;
  readonly model: BriefModel;
  readonly allowedEngines: readonly EngineId[];
  readonly now: () => Date;
};

async function callsInLastHour(options: { readonly paths: LivePaths; readonly id: string; readonly now: Date }) {
  const since = options.now.getTime() - hourMilliseconds;

  return (await readBriefCalls(options)).filter((call) => new Date(call).getTime() > since);
}

async function briefOnce(options: BriefRun): Promise<BriefOutcome> {
  const { paths, id } = options;
  const record = await readRecord({ paths, id });

  if (record === null) {
    return { kind: "skipped", reason: "missing" };
  }

  if (record.summary === "") {
    return { kind: "skipped", reason: "no-message" };
  }

  if (!options.allowedEngines.includes(engineIdOf(record.engine))) {
    return { kind: "skipped", reason: "engine-not-allowed" };
  }

  const messageDigest = briefMessageDigest(record.summary);

  if ((await readBrief({ paths, id }))?.messageDigest === messageDigest) {
    return { kind: "skipped", reason: "unchanged" };
  }

  const startedAt = options.now();
  const calls = await callsInLastHour({ paths, id, now: startedAt });

  if (calls.length >= briefCallsPerHour) {
    return { kind: "skipped", reason: "limited" };
  }

  await saveBriefCalls({ paths, id, calls: [...calls, startedAt.toISOString()] });

  const answer = await options
    .model({
      engine: record.engine,
      prompt: briefRequest({ task: await readTask({ paths, id }), lastMessage: record.summary }),
      outputSchema: briefAnswerJsonSchema,
      signal: AbortSignal.timeout(briefCallMilliseconds),
    })
    .then(
      (value) => ({ kind: "answered" as const, value }),
      () => ({ kind: "failed" as const }),
    );

  if (answer.kind === "failed") {
    return { kind: "failed", reason: "model" };
  }

  const brief = briefFromAnswer({ answer: answer.value, messageDigest, now: options.now() });

  if (brief === null) {
    return { kind: "failed", reason: "invalid" };
  }

  await saveBrief({ paths, id, brief });

  return { kind: "written", brief };
}

export async function writeBrief(options: {
  readonly paths: LivePaths;
  readonly id: string;
  readonly model: BriefModel;
  readonly allowedEngines: readonly EngineId[];
  readonly now?: () => Date;
}): Promise<BriefOutcome> {
  if ((await readRecord(options)) === null) {
    return { kind: "skipped", reason: "missing" };
  }

  const lock = await acquireLocalLock(briefLockFile(options));

  if (lock === null) {
    return { kind: "skipped", reason: "busy" };
  }

  const run: BriefRun = { ...options, now: options.now ?? (() => new Date()) };

  try {
    const first = await briefOnce(run);
    const again = first.kind === "written" ? await briefOnce(run) : first;

    return again.kind === "skipped" ? first : again;
  } finally {
    lock.release();
  }
}
