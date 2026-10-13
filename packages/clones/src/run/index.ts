import type { GithubCall } from "../github";
import { sessionEngine, type SessionConfig } from "../session/config";
import { providerLogins } from "../session/providers";
import { claimRequest, type ClaimOutcome } from "../state/claims";
import { writeStatus, type SessionStatus } from "../state/statusComment";
import { resolveSessionRequest } from "../trigger";
import type { SessionEvent, SessionRequest } from "../trigger/event";
import { prepareEngine } from "./engine";
import { finishWork } from "./finish";
import type { Processes } from "./processes";
import { runReview } from "./review";
import { saveUnfinishedWork, type SaveOutcome } from "./save";
import { prepareWorkspace } from "./workspace";

export type SessionOutcome =
  | { readonly kind: "ignored"; readonly reason: string }
  | { readonly kind: "not-claimed"; readonly claim: Exclude<ClaimOutcome, { kind: "claimed" }> }
  | { readonly kind: "finished"; readonly status: SessionStatus };

export type RunContext = {
  readonly config: SessionConfig;
  readonly github: GithubCall;
  readonly processes: Processes;
  readonly root: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly signal: AbortSignal;
  readonly now: () => Date;
};

const usageLimitPattern = /usage limit|rate limit reached|limit will reset|You've hit your limit/i;

async function acknowledge(options: {
  readonly context: RunContext;
  readonly request: SessionRequest;
}): Promise<void> {
  const { context, request } = options;
  const route =
    request.source === "issue_comment"
      ? `repos/${context.config.repository}/issues/comments/${request.identifier}/reactions`
      : request.source === "pull_request_review_comment"
        ? `repos/${context.config.repository}/pulls/comments/${request.identifier}/reactions`
        : null;

  if (route !== null) {
    await context.github({ method: "POST", route, body: { content: "eyes" } });
  }
}

function finalState(options: {
  readonly exitCode: number;
  readonly tail: string;
  readonly aborted: boolean;
}): SessionStatus["state"] {
  if (options.exitCode !== 0 && usageLimitPattern.test(options.tail)) {
    return "limited";
  }

  if (options.aborted) {
    return "saved";
  }

  return options.exitCode === 0 ? "done" : "failed";
}

function finalDetail(options: {
  readonly state: SessionStatus["state"];
  readonly saved: SaveOutcome;
  readonly exitCode: number;
}): string {
  const saved =
    options.saved === "saved"
      ? " The unfinished work is on the branch."
      : options.saved === "push-failed"
        ? " The unfinished work could not be pushed."
        : "";

  return options.state === "done"
    ? `The session finished.${saved}`
    : options.state === "limited"
      ? `The model login reached a usage limit. Start the session again after the limit resets.${saved}`
      : options.state === "saved"
        ? `The session reached its time limit or the host stopped it.${saved}`
        : `The agent exited with code ${options.exitCode}.${saved}`;
}

export async function runSession(
  options: RunContext & { readonly event: SessionEvent },
): Promise<SessionOutcome> {
  const { config, github, processes } = options;
  const resolution = await resolveSessionRequest({
    github,
    config,
    event: options.event,
    now: options.now(),
  });

  if (resolution.kind === "ignored") {
    return resolution;
  }

  const { request } = resolution;

  if (request.kind === "review" && !providerLogins[config.provider].reviews) {
    return {
      kind: "ignored",
      reason: `Reviews do not support the ${config.provider} provider yet.`,
    };
  }

  const claim = await claimRequest({ github, config, request, now: options.now() });

  if (claim.kind !== "claimed") {
    return { kind: "not-claimed", claim };
  }

  const startedAt = options.now().toISOString();
  const status = (
    state: SessionStatus["state"],
    extra: Partial<Pick<SessionStatus, "pull" | "detail">>,
  ): SessionStatus => ({
    state,
    key: request.key,
    kind: request.kind,
    branch: request.branch,
    engine: sessionEngine(config),
    pull: extra.pull ?? (request.pull ? request.entity : null),
    startedAt,
    updatedAt: options.now().toISOString(),
    detail: extra.detail ?? "",
  });

  await acknowledge({ context: options, request });
  await writeStatus({ github, config, entity: request.entity, status: status("working", {}) });

  try {
    const workspace = await prepareWorkspace({ config, request, processes, root: options.root });
    const result =
      request.kind === "review"
        ? await runReview({ ...options, request, workspace })
        : await processes.stream({
            ...(await prepareEngine({ ...options, request, workspace })),
            cwd: workspace.repository,
            signal: options.signal,
          });
    const saved = await saveUnfinishedWork({ github, config, request, workspace, processes });
    const { pull } = await finishWork({ github, config, request, workspace, processes });
    const state = finalState({ ...result, aborted: options.signal.aborted });
    const finished = status(state, {
      pull,
      detail: finalDetail({ state, saved, exitCode: result.exitCode }),
    });

    await writeStatus({ github, config, entity: request.entity, status: finished });

    return { kind: "finished", status: finished };
  } catch (error) {
    const failed = status("failed", {
      detail: `The session stopped: ${error instanceof Error ? error.message : String(error)}`,
    });

    await writeStatus({ github, config, entity: request.entity, status: failed });

    return { kind: "finished", status: failed };
  }
}
