import { acquireLocalLock } from "@shadowclone/core";
import { readCloneConfig } from "../config/store";
import { finalStates, type CloneState } from "../node/progress";
import { cloneState } from "../node/record";
import { endedRecord } from "../node/transitions";
import { readInbox } from "../node/inbox";
import { listRuns, removeRun, writeRecord, type StoredRun } from "../node/store";
import { errorText, failBeforeStart, launchClone, type Running, type ServeContext } from "./clone";

export const scanMilliseconds = 2_000;

export const parallelClones = 2;

export const keepFinishedMilliseconds = 30 * 86_400_000;

const interruptedStates: readonly CloneState[] = ["working", "waiting"];

async function settleEarlierRuns(options: {
  readonly context: ServeContext;
  readonly runs: readonly StoredRun[];
}): Promise<void> {
  const { context } = options;
  const now = context.now();

  for (const run of options.runs) {
    const { record } = run;
    const id = run.request.id;

    if (record !== null && interruptedStates.includes(record.state)) {
      await writeRecord({
        paths: context.paths,
        id,
        record: endedRecord({
          record,
          state: "stopped",
          detail:
            "The node stopped while the clone ran. Its work is on the branch if the save finished.",
          now,
        }),
      });
    } else if (
      record !== null &&
      finalStates.includes(record.state) &&
      now.getTime() - Date.parse(record.updatedAt) > keepFinishedMilliseconds
    ) {
      await removeRun({ paths: context.paths, id });
    }
  }
}

export async function scanRuns(options: {
  readonly context: ServeContext;
  readonly running: Map<string, Running>;
}): Promise<void> {
  const { context, running } = options;
  const { runs } = await listRuns(context.paths);

  for (const run of runs) {
    const active = running.get(run.request.id);

    if (active !== undefined && run.stopRequested && !active.controller.signal.aborted) {
      context.log(`Stopping clone ${run.request.id}.`);
      active.controller.abort();
    }

    if (active !== undefined && !active.controller.signal.aborted) {
      await active.forward(await readInbox({ paths: context.paths, id: run.request.id }));
    }
  }

  const queued = runs
    .filter((run) => cloneState(run) === "queued" && !running.has(run.request.id))
    .sort((left, right) => left.request.createdAt.localeCompare(right.request.createdAt));

  for (const run of queued) {
    if (running.size >= parallelClones) {
      return;
    }

    const id = run.request.id;
    const config = await readCloneConfig({
      paths: context.paths,
      repository: run.request.repository,
    }).catch(errorText);

    if (config === null || typeof config === "string") {
      await failBeforeStart({
        context,
        id,
        detail: config ?? `${run.request.repository} has no clone setup on this machine.`,
      });
      continue;
    }

    const loginBusy =
      config.provider === "chatgpt-subscription" &&
      [...running.values()].some((entry) => entry.provider === "chatgpt-subscription");

    if (!loginBusy) {
      const entry = launchClone({ context, run, config });

      running.set(id, entry);
      entry.done.finally(() => running.delete(id)).catch(context.log);
    }
  }
}

function pause(options: { readonly milliseconds: number; readonly signal: AbortSignal }) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, options.milliseconds);

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

export async function serveClones(
  options: ServeContext & { readonly signal: AbortSignal; readonly scanEvery?: number },
): Promise<"stopped" | "already-running"> {
  const lock = await acquireLocalLock(options.paths.serveLockFile);

  if (lock === null) {
    return "already-running";
  }

  const running = new Map<string, Running>();

  try {
    await settleEarlierRuns({ context: options, runs: (await listRuns(options.paths)).runs });
    options.log("shadowclone serve starts queued clones on this machine.");

    while (!options.signal.aborted) {
      await scanRuns({ context: options, running }).catch((error: unknown) =>
        options.log(`The scan failed: ${errorText(error)}`),
      );
      await pause({ milliseconds: options.scanEvery ?? scanMilliseconds, signal: options.signal });
    }

    for (const entry of running.values()) {
      entry.controller.abort();
    }

    await Promise.all([...running.values()].map((entry) => entry.done));
  } finally {
    lock.release();
  }

  return "stopped";
}
