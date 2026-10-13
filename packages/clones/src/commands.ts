import { mkdtemp, readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { githubData, githubThroughGh, type GithubCall } from "./github";
import { runSession, type SessionOutcome } from "./run";
import { hostProcesses } from "./run/processes";
import { sessionConfigSchema, type SessionConfig } from "./session/config";
import type { ClonesPaths } from "./session/store";
import { parseStatus, type SessionStatus } from "./state/statusComment";
import { runContainerCheck, type CheckLine } from "./setup/check";
import { sessionEventSchema } from "./trigger/event";

export const sessionMinutes = 170;

type Environment = Readonly<Record<string, string | undefined>>;

function configFromEnvironment(environment: Environment): SessionConfig {
  return sessionConfigSchema.parse(JSON.parse(environment.SHADOWCLONE_SESSION_CONFIG ?? "null"));
}

export async function runContainerSession(options: {
  readonly environment: Environment;
  readonly signal: AbortSignal;
}): Promise<SessionOutcome> {
  const config = configFromEnvironment(options.environment);
  const event = sessionEventSchema.parse(
    JSON.parse(options.environment.SHADOWCLONE_SESSION_EVENT ?? "null"),
  );

  return runSession({
    config,
    event,
    github: githubThroughGh,
    processes: hostProcesses,
    root: await mkdtemp(path.join(os.tmpdir(), "shadowclone-session-")),
    environment: options.environment,
    signal: AbortSignal.any([options.signal, AbortSignal.timeout(sessionMinutes * 60_000)]),
    now: () => new Date(),
  });
}

export async function runContainerCheckFromEnvironment(
  environment: Environment,
): Promise<readonly CheckLine[]> {
  return runContainerCheck({
    config: configFromEnvironment(environment),
    github: githubThroughGh,
    processes: hostProcesses,
    root: await mkdtemp(path.join(os.tmpdir(), "shadowclone-check-")),
    environment,
  });
}

export async function startSession(options: {
  readonly github: GithubCall;
  readonly repository: string;
  readonly entity: number;
  readonly task: string;
}): Promise<string> {
  const comment = z.object({ html_url: z.string() }).parse(
    await githubData({
      github: options.github,
      method: "POST",
      route: `repos/${options.repository}/issues/${options.entity}/comments`,
      body: { body: `/shadowclone ${options.task}`.trimEnd() },
    }),
  );

  return comment.html_url;
}

const recentCommentsSchema = z.array(
  z.object({
    body: z.string().nullable(),
    html_url: z.string(),
    user: z.object({ id: z.number() }).nullable(),
  }),
);

export async function listSessions(options: {
  readonly github: GithubCall;
  readonly config: SessionConfig;
}): Promise<readonly (SessionStatus & { readonly url: string })[]> {
  const comments = recentCommentsSchema.parse(
    await githubData({
      github: options.github,
      route: `repos/${options.config.repository}/issues/comments?sort=updated&direction=desc&per_page=100`,
    }),
  );

  return comments.flatMap((comment) => {
    const status =
      comment.user?.id === options.config.ownerId ? parseStatus(comment.body ?? "") : null;

    return status === null ? [] : [{ ...status, url: comment.html_url }];
  });
}

export async function latestSessionLog(paths: ClonesPaths): Promise<string | null> {
  const names = (await readdir(paths.logsDirectory).catch(() => [])).filter(
    (name) => name.startsWith("shadowclone-") && name.endsWith(".log"),
  );
  const dated = await Promise.all(
    names.map(async (name) => ({
      file: path.join(paths.logsDirectory, name),
      modified: (await stat(path.join(paths.logsDirectory, name))).mtimeMs,
    })),
  );

  return dated.sort((left, right) => right.modified - left.modified)[0]?.file ?? null;
}
