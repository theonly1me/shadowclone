import { acquireLocalLock } from "@shadowclone/core";
import { providerLogins } from "../config/providers";
import { readCloneConfig, type ClonesPaths } from "../config/store";
import { cloneRequest, refusal } from "./admission";
import { cloneView, isActive, type CloneView } from "./record";
import { newCloneId } from "./request";
import { createRun, listRuns, readRun, writeStopMarker } from "./store";

export type CloneStartInput = {
  readonly repository: string;
  readonly task: string;
  readonly issue?: number;
  readonly pull?: number;
  readonly review?: boolean;
};

export type StartOutcome =
  | { readonly kind: "queued"; readonly clone: CloneView; readonly serveRunning: boolean }
  | { readonly kind: "refused"; readonly reason: string };

export type StopOutcome =
  | { readonly kind: "stopping" | "already-finished"; readonly clone: CloneView }
  | { readonly kind: "unknown" };

export type CloneList = {
  readonly clones: readonly CloneView[];
  readonly unreadable: readonly string[];
};

export type CloneNode = {
  readonly start: (input: CloneStartInput) => Promise<StartOutcome>;
  readonly list: (options: { readonly repository?: string }) => Promise<CloneList>;
  readonly get: (id: string) => Promise<CloneView | null>;
  readonly stop: (id: string) => Promise<StopOutcome>;
};

async function serveRunning(paths: ClonesPaths): Promise<boolean> {
  const lock = await acquireLocalLock(paths.serveLockFile);

  lock?.release();

  return lock === null;
}

const startLockTries = 100;

const startLockPauseMilliseconds = 50;

async function startLock(paths: ClonesPaths): Promise<{ readonly release: () => void } | null> {
  for (let attempt = 0; attempt < startLockTries; attempt++) {
    const lock = await acquireLocalLock(paths.startLockFile);

    if (lock !== null) {
      return lock;
    }

    await Bun.sleep(startLockPauseMilliseconds);
  }

  return null;
}

type StartOptions = {
  readonly paths: ClonesPaths;
  readonly now: () => Date;
  readonly newId: () => string;
  readonly input: CloneStartInput;
};

async function startClone(options: StartOptions): Promise<StartOutcome> {
  const { paths, input } = options;
  const config = await readCloneConfig({ paths, repository: input.repository }).catch(
    (error: unknown) => (error instanceof Error ? error.message : String(error)),
  );

  if (config === null || typeof config === "string") {
    return {
      kind: "refused",
      reason:
        config ??
        `${input.repository} has no clone setup on this machine. Run shadowclone clone setup --repo ${input.repository}.`,
    };
  }

  if (input.review === true && !providerLogins[config.provider].reviews) {
    return { kind: "refused", reason: `Reviews do not support the ${config.provider} provider yet.` };
  }

  const lock = await startLock(paths);

  if (lock === null) {
    return {
      kind: "refused",
      reason: "Another clone start on this machine did not finish in 5 seconds. Try again.",
    };
  }

  try {
    return await admitClone({ ...options, dailyClones: config.dailyClones });
  } finally {
    lock.release();
  }
}

async function admitClone(
  options: StartOptions & { readonly dailyClones: number },
): Promise<StartOutcome> {
  const { paths, input } = options;

  for (let attempt = 0; attempt < 3; attempt++) {
    const now = options.now();
    const request = cloneRequest({ input, id: options.newId(), now });

    if (typeof request === "string") {
      return { kind: "refused", reason: request };
    }

    const { runs } = await listRuns(paths);
    const reason = refusal({ request, runs, dailyClones: options.dailyClones, now });

    if (reason !== null) {
      return { kind: "refused", reason };
    }

    if ((await createRun({ paths, request })) === "created") {
      return {
        kind: "queued",
        clone: cloneView({ request, record: null, stopRequested: false }),
        serveRunning: await serveRunning(paths),
      };
    }
  }

  throw new Error("Three new clone ids were already in use. Try again.");
}

export function localNode(options: {
  readonly paths: ClonesPaths;
  readonly now?: () => Date;
  readonly newId?: () => string;
}): CloneNode {
  const { paths } = options;
  const now = options.now ?? (() => new Date());

  return {
    start: (input) => startClone({ paths, now, newId: options.newId ?? newCloneId, input }),
    list: async ({ repository }) => {
      const { runs, unreadable } = await listRuns(paths);
      const clones = runs
        .filter((run) => repository === undefined || run.request.repository === repository)
        .map(cloneView)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

      return { clones, unreadable };
    },
    get: async (id) => {
      const run = await readRun({ paths, id });

      return run === null ? null : cloneView(run);
    },
    stop: async (id) => {
      const run = await readRun({ paths, id });

      if (run === null) {
        return { kind: "unknown" };
      }

      if (!isActive(run)) {
        return { kind: "already-finished", clone: cloneView(run) };
      }

      await writeStopMarker({ paths, id, now: now() });

      return { kind: "stopping", clone: cloneView({ ...run, stopRequested: true }) };
    },
  };
}
