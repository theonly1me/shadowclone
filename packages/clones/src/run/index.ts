import path from "node:path";
import { cloneEngine, type CloneConfig } from "../config/config";
import { providerLogins } from "../config/providers";
import type { GithubCall } from "../github";
import type { Progress } from "../node/progress";
import type { CloneRequest } from "../node/request";
import { claudeDriver } from "./drive/claude";
import { codexDriver } from "./drive/codex";
import { superviseEngine } from "./drive/supervise";
import { prepareEngine } from "./engine";
import { finishWork } from "./finish";
import { boundedSummary, finalDetail, finalState, type EngineOutcome } from "./outcome";
import type { Processes } from "./processes";
import type { WorkClone } from "./prompt";
import { resolveClone } from "./resolve";
import { runReview } from "./review";
import { saveUnfinishedWork } from "./save";
import { prepareWorkspace, type Workspace } from "./workspace";

export type RunContext = {
  readonly config: CloneConfig;
  readonly github: GithubCall;
  readonly processes: Processes;
  readonly root: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly signal: AbortSignal;
  readonly inbox: AsyncIterable<string>;
  readonly report: (progress: Progress) => void;
  readonly waitMilliseconds?: number;
};

const detailLimit = 2000;

async function runWork(
  options: RunContext & { readonly clone: WorkClone; readonly workspace: Workspace },
): Promise<EngineOutcome> {
  const questionsFile = path.join(options.root, "questions.jsonl");
  const launch = await prepareEngine({ ...options, questionsFile });
  const engine = options.processes.open({
    arguments: launch.arguments,
    environment: launch.environment,
    cwd: options.workspace.repository,
  });
  const driver =
    launch.codex === null
      ? claudeDriver({ engine, prompt: launch.prompt })
      : codexDriver({ engine, prompt: launch.prompt, thread: launch.codex });
  const supervision = await superviseEngine({
    driver,
    inbox: options.inbox,
    questionsFile,
    report: options.report,
    base: { branch: options.clone.branch, engine: cloneEngine(options.config) },
    signal: options.signal,
    ...(options.waitMilliseconds === undefined
      ? {}
      : { waitMilliseconds: options.waitMilliseconds }),
  });

  return { outcome: supervision.outcome, tail: engine.tail(), summary: supervision.summary };
}

export async function runClone(
  options: RunContext & { readonly request: CloneRequest },
): Promise<Progress> {
  const { config, github, processes, report } = options;
  const engine = cloneEngine(config);
  const finish = (progress: Progress): Progress => {
    const bounded = { ...progress, detail: progress.detail.slice(0, detailLimit) };

    report(bounded);

    return bounded;
  };

  try {
    report({ state: "working", engine, detail: "Reading the request on GitHub." });

    const resolution = await resolveClone({ github, config, request: options.request });

    if (resolution.kind === "refused") {
      return finish({ state: "failed", engine, detail: resolution.reason });
    }

    const { clone } = resolution;
    const { branch } = clone;

    if (clone.kind === "review" && !providerLogins[config.provider].reviews) {
      return finish({
        state: "failed",
        engine,
        detail: `Reviews do not support the ${config.provider} provider yet.`,
      });
    }

    report({ state: "working", branch, engine, detail: "Cloning the repository and the skills." });

    const workspace = await prepareWorkspace({ config, clone, processes, root: options.root });

    report({
      state: "working",
      branch,
      engine,
      detail: clone.kind === "review" ? "Reviewing the pull request." : "The agent is working.",
    });

    const result: EngineOutcome =
      clone.kind === "review"
        ? await runReview({ ...options, pull: clone.pull, workspace }).then((review) => ({
            outcome: review.exitCode === 0 ? "completed" : "failed",
            tail: review.tail,
            summary: "",
          }))
        : await runWork({ ...options, clone, workspace });
    const saved = await saveUnfinishedWork({ config, clone, workspace, processes });
    const { pull } = await finishWork({ github, config, clone, workspace, processes });
    const state = finalState({ result, aborted: options.signal.aborted });
    const summary = boundedSummary(result.summary);

    return finish({
      state,
      branch,
      engine,
      ...(pull === null ? {} : { pull }),
      ...(summary === undefined ? {} : { summary }),
      detail: finalDetail({ state, saved }),
    });
  } catch (error) {
    return finish({
      state: "failed",
      engine,
      detail: `The clone stopped: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
