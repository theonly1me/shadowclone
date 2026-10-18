import type { CloneStartInput } from ".";
import { isActive } from "./record";
import { busyTarget, type CloneRequest, type CloneTarget } from "./request";
import type { StoredRun } from "./store";

const dayMilliseconds = 86_400_000;

function workTarget(input: CloneStartInput): CloneTarget | string {
  if (input.issue !== undefined && input.pull !== undefined) {
    return "Name an issue or a pull request, not both.";
  }

  if (input.issue !== undefined) {
    return { kind: "issue", number: input.issue };
  }

  return input.pull === undefined ? { kind: "new" } : { kind: "pull", number: input.pull };
}

export function cloneRequest(options: {
  readonly input: CloneStartInput;
  readonly id: string;
  readonly now: Date;
}): CloneRequest | string {
  const { input } = options;
  const shared = {
    version: 1,
    id: options.id,
    repository: input.repository,
    createdAt: options.now.toISOString(),
  } as const;

  if (input.review === true) {
    return input.pull === undefined || input.issue !== undefined
      ? "A review needs a pull request number and no issue."
      : { ...shared, kind: "review", pull: input.pull };
  }

  const target = workTarget(input);

  if (typeof target === "string") {
    return target;
  }

  return target.kind === "new" && input.task.trim() === ""
    ? "Describe the task, or name an issue or a pull request."
    : { ...shared, kind: "work", task: input.task, target };
}

export function refusal(options: {
  readonly request: CloneRequest;
  readonly runs: readonly StoredRun[];
  readonly dailyClones: number;
  readonly now: Date;
}): string | null {
  const { request } = options;
  const sameRepository = options.runs.filter((run) => run.request.repository === request.repository);
  const recent = sameRepository.filter(
    (run) => options.now.getTime() - Date.parse(run.request.createdAt) < dayMilliseconds,
  );

  if (recent.length >= options.dailyClones) {
    return `${request.repository} already had ${recent.length} clones in the last 24 hours, and its limit is ${options.dailyClones}.`;
  }

  const target = busyTarget(request);
  const busy = sameRepository.find(
    (run) => target !== null && isActive(run) && busyTarget(run.request) === target,
  );

  return busy === undefined
    ? null
    : `Clone ${busy.request.id} already works on ${target?.replace(":", " #")}. Stop it first, or wait until it finishes.`;
}
