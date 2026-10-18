import type { CloneConfig } from "../config/config";
import type { ClonesPaths } from "../config/store";
import { finalStates, type Progress } from "../node/progress";
import type { InboxEntry } from "../node/inbox";
import { deliveredRecord, endedRecord, progressedRecord, startedRecord } from "../node/transitions";
import { writeRecord, type CloneRecord, type StoredRun } from "../node/store";
import type { Launch } from "./docker";

export type ServeContext = {
  readonly paths: ClonesPaths;
  readonly launch: Launch;
  readonly now: () => Date;
  readonly log: (line: string) => void;
};

export type Running = {
  readonly provider: CloneConfig["provider"];
  readonly controller: AbortController;
  readonly done: Promise<void>;
  readonly forward: (entries: readonly InboxEntry[]) => Promise<void>;
};

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function launchClone(options: {
  readonly context: ServeContext;
  readonly run: StoredRun;
  readonly config: CloneConfig;
}): Running {
  const { context, run, config } = options;
  const id = run.request.id;
  const controller = new AbortController();
  let record: CloneRecord = startedRecord(context.now());
  let reported = false;
  let saving: Promise<void> = Promise.resolve();
  let deliver: ((line: string) => void) | null = null;
  let delivered = 0;
  const save = () => {
    saving = saving.then(() => writeRecord({ paths: context.paths, id, record }));

    return saving;
  };
  const forward = async (entries: readonly InboxEntry[]) => {
    for (const entry of entries.slice(delivered)) {
      if (deliver === null) {
        return;
      }

      deliver(JSON.stringify(entry));
      delivered++;
      record = deliveredRecord({
        record,
        delivery: entry.kind === "message" ? { kind: "message" } : entry,
        now: context.now(),
      });
      await save();
    }
  };
  const onProgress = async (progress: Progress) => {
    record = progressedRecord({ record, progress, now: context.now() });
    reported = finalStates.includes(progress.state);
    await save();
  };
  const done = (async () => {
    await save();
    context.log(`Starting clone ${id} for ${config.repository}.`);

    try {
      const exitCode = await context.launch({
        config,
        request: run.request,
        signal: controller.signal,
        onProgress,
        attach: (send) => {
          deliver = send;
        },
      });

      deliver = null;

      if (!reported) {
        record = endedRecord({
          record,
          state: controller.signal.aborted ? "stopped" : "failed",
          detail: `The container exited with code ${exitCode} before it reported a result.`,
          now: context.now(),
        });
      }

      context.log(`Clone ${id} exited with code ${exitCode}.`);
    } catch (error) {
      record = endedRecord({
        record,
        state: "failed",
        detail: `The container could not start: ${errorText(error)}`,
        now: context.now(),
      });
      context.log(`Clone ${id} could not start: ${errorText(error)}`);
    }

    await save();
  })();

  return { provider: config.provider, controller, done, forward };
}

export async function failBeforeStart(options: {
  readonly context: ServeContext;
  readonly id: string;
  readonly detail: string;
}): Promise<void> {
  const now = options.context.now();

  await writeRecord({
    paths: options.context.paths,
    id: options.id,
    record: endedRecord({
      record: startedRecord(now),
      state: "failed",
      detail: options.detail,
      now,
    }),
  });
}
