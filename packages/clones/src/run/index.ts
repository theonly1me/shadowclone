import { cloneEngine, type CloneConfig } from "../config/config";
import { providerLogins } from "../config/providers";
import type { GithubCall } from "../github";
import type { Progress } from "../node/progress";
import type { CloneRequest } from "../node/request";
import { prepareEngine } from "./engine";
import { finishWork } from "./finish";
import type { Processes } from "./processes";
import { resolveClone } from "./resolve";
import { runReview } from "./review";
import { saveUnfinishedWork, type SaveOutcome } from "./save";
import { prepareWorkspace } from "./workspace";

export type RunContext = {
  readonly config: CloneConfig;
  readonly github: GithubCall;
  readonly processes: Processes;
  readonly root: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly signal: AbortSignal;
  readonly report: (progress: Progress) => void;
};

type FinalState = Exclude<Progress["state"], "working">;

const usageLimitPattern = /usage limit|rate limit reached|limit will reset|You've hit your limit/i;

const detailLimit = 2000;

function finalState(options: {
  readonly exitCode: number;
  readonly tail: string;
  readonly aborted: boolean;
}): FinalState {
  if (options.exitCode !== 0 && usageLimitPattern.test(options.tail)) {
    return "limited";
  }

  if (options.aborted) {
    return "stopped";
  }

  return options.exitCode === 0 ? "done" : "failed";
}

function finalDetail(options: {
  readonly state: FinalState;
  readonly saved: SaveOutcome;
  readonly exitCode: number;
}): string {
  const saved =
    options.saved === "saved"
      ? " The unfinished work is on the branch."
      : options.saved === "push-failed"
        ? " The unfinished work could not be pushed."
        : "";
  const details: Readonly<Record<FinalState, string>> = {
    done: "The clone finished.",
    limited: "The model login reached a usage limit. Start the clone again after the limit resets.",
    stopped: "The clone stopped before it finished, from a stop request or its time limit.",
    failed: `The agent exited with code ${options.exitCode}.`,
  };

  return `${details[options.state]}${saved}`;
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

    const result =
      clone.kind === "review"
        ? await runReview({ ...options, pull: clone.pull, workspace })
        : await processes.stream({
            ...(await prepareEngine({ ...options, clone, workspace })),
            cwd: workspace.repository,
            signal: options.signal,
          });
    const saved = await saveUnfinishedWork({ config, clone, workspace, processes });
    const { pull } = await finishWork({ github, config, clone, workspace, processes });
    const state = finalState({ ...result, aborted: options.signal.aborted });

    return finish({
      state,
      branch,
      engine,
      ...(pull === null ? {} : { pull }),
      detail: finalDetail({ state, saved, exitCode: result.exitCode }),
    });
  } catch (error) {
    return finish({
      state: "failed",
      engine,
      detail: `The clone stopped: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
