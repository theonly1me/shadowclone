import type { CloneConfig } from "../config/config";
import type { ClonesPaths } from "../config/store";
import { finalStates, type Progress } from "../node/progress";
import { endedRecord, progressedRecord, startedRecord } from "../node/record";
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
  const save = () => writeRecord({ paths: context.paths, id, record });
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
      });

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

  return { provider: config.provider, controller, done };
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
    record: endedRecord({ record: startedRecord(now), state: "failed", detail: options.detail, now }),
  });
}
