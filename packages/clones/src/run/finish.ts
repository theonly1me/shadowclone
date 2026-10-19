import { z } from "zod";
import { githubData, type GithubCall } from "../github";
import type { CloneConfig } from "../config/config";
import { cloneLabel, type ResolvedClone } from "./resolve";
import type { Processes } from "./processes";
import type { Workspace } from "./workspace";

const pullSchema = z.object({
  number: z.number().int().positive(),
  body: z.string().nullable(),
  head: z.object({ ref: z.string() }),
});

export function cloneBodyLine(config: CloneConfig): string {
  return `Made by a shadowclone clone for @${config.ownerLogin}.`;
}

export async function remoteHead(options: {
  readonly processes: Processes;
  readonly workspace: Workspace;
  readonly branch: string;
}): Promise<string | null> {
  const result = await options.processes.run({
    arguments: ["git", "ls-remote", "--heads", "origin", `refs/heads/${options.branch}`],
    cwd: options.workspace.repository,
  });
  const sha = /^([a-f0-9]{40})\s/.exec(result.stdout)?.[1];

  return result.exitCode === 0 && sha !== undefined ? sha : null;
}

async function markPull(options: {
  readonly github: GithubCall;
  readonly config: CloneConfig;
  readonly branch: string;
}): Promise<number | null> {
  const { github, config } = options;
  const owner = config.repository.split("/")[0] ?? "";
  const pulls = z.array(pullSchema).parse(
    await githubData({
      github,
      route: `repos/${config.repository}/pulls?state=open&head=${encodeURIComponent(`${owner}:${options.branch}`)}&per_page=100`,
    }),
  );
  const pull = pulls.find((candidate) => candidate.head.ref === options.branch);

  if (pull === undefined) {
    return null;
  }

  await githubData({
    github,
    method: "POST",
    route: `repos/${config.repository}/issues/${pull.number}/labels`,
    body: { labels: [cloneLabel] },
  });

  const body = pull.body ?? "";
  const line = cloneBodyLine(config);

  if (!body.includes(line)) {
    await githubData({
      github,
      method: "PATCH",
      route: `repos/${config.repository}/pulls/${pull.number}`,
      body: { body: body.trim() === "" ? line : `${body.trimEnd()}\n\n${line}` },
    });
  }

  return pull.number;
}

export async function finishWork(options: {
  readonly github: GithubCall;
  readonly config: CloneConfig;
  readonly clone: ResolvedClone;
  readonly workspace: Workspace;
  readonly processes: Processes;
}): Promise<{ readonly pull: number | null }> {
  const { github, config, clone } = options;

  if (clone.kind === "review") {
    return { pull: clone.pull.number };
  }

  const head = await remoteHead({ ...options, branch: clone.branch });

  if (head === null) {
    return { pull: clone.pull?.number ?? null };
  }

  return { pull: await markPull({ github, config, branch: clone.branch }) };
}
