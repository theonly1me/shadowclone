import { z } from "zod";
import type { Clone } from "../types";
import { readCloudChecklist, type ChecklistItem } from "./checklist";
import type { GhApiCall } from "./ghApi";

export type CloneCheck =
  | { readonly kind: "not-ready"; readonly checklist: readonly ChecklistItem[] }
  | { readonly kind: "passed"; readonly url: string }
  | { readonly kind: "failed"; readonly url: string; readonly step: string }
  | { readonly kind: "running"; readonly url: string | null };

const runsSchema = z.object({
  workflow_runs: z.array(z.object({
    id: z.number().int().positive(),
    created_at: z.iso.datetime(),
    status: z.string(),
    conclusion: z.string().nullable(),
    html_url: z.url(),
  })),
});

const jobsSchema = z.object({
  jobs: z.array(z.object({
    steps: z.array(z.object({ name: z.string(), conclusion: z.string().nullable() })).default([]),
  })),
});

type CheckRun = z.infer<typeof runsSchema>["workflow_runs"][number];

const pollMilliseconds = 10_000;

async function readRuns(options: { readonly call: GhApiCall; readonly workflow: string }): Promise<readonly CheckRun[]> {
  const runs = await options.call({ route: `${options.workflow}/runs?event=workflow_dispatch&per_page=5` });

  return runsSchema.parse(runs.data).workflow_runs;
}

export async function runCloneCheck(options: {
  readonly clone: Clone;
  readonly call: GhApiCall;
  readonly pullUrl: string | null;
  readonly limitMilliseconds: number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly now?: () => number;
}): Promise<CloneCheck> {
  const { clone, call } = options;
  const sleep = options.sleep ?? Bun.sleep;
  const now = options.now ?? Date.now;
  const checklist = await readCloudChecklist({ call, clone, pullUrl: options.pullUrl });

  if (checklist.some((item) => !item.done && item.key !== "invitation")) {
    return { kind: "not-ready", checklist };
  }

  const startedAt = now();
  const workflow = `repos/${clone.repository}/actions/workflows/shadowclone-check.yml`;
  const running = (await readRuns({ call, workflow })).find((run) => run.status !== "completed");

  if (!running) {
    const dispatched = await call({ method: "POST", route: `${workflow}/dispatches`, body: { ref: clone.defaultBranch } });

    if (dispatched.status !== 204) {
      throw new Error(`GitHub refused to start the check run (HTTP ${dispatched.status}). Merge the setup pull request first.`);
    }
  }

  const isThisCheck = (run: CheckRun) =>
    running ? run.id === running.id : Date.parse(run.created_at) >= startedAt - 60_000;
  let latestUrl = running?.html_url ?? null;

  while (now() - startedAt < options.limitMilliseconds) {
    await sleep(pollMilliseconds);

    const run = (await readRuns({ call, workflow })).find(isThisCheck);

    if (!run) {
      continue;
    }

    latestUrl = run.html_url;

    if (run.status !== "completed") {
      continue;
    }

    if (run.conclusion === "success") {
      return { kind: "passed", url: run.html_url };
    }

    const jobs = await call({ route: `repos/${clone.repository}/actions/runs/${run.id}/jobs` });
    const failed = jobsSchema.parse(jobs.data).jobs.flatMap((job) => job.steps).find((step) => step.conclusion === "failure");

    return { kind: "failed", url: run.html_url, step: failed?.name ?? run.conclusion ?? "unknown step" };
  }

  return { kind: "running", url: latestUrl };
}
