import { mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { GithubCall } from "./github";
import { cloneConfigSchema, type CloneConfig, type CloneConfigInput } from "./config/config";
import { clonesPaths, saveCloneConfig, type ClonesPaths } from "./config/store";

type FakeResponse = { readonly status: number; readonly data: unknown };

export type FakeRoutes = Record<string, FakeResponse | ((body: unknown) => FakeResponse)>;

export type GithubCallRecord = {
  readonly method: string;
  readonly route: string;
  readonly body: unknown;
};

export function fakeGithub(routes: FakeRoutes): {
  readonly github: GithubCall;
  readonly calls: GithubCallRecord[];
} {
  const calls: GithubCallRecord[] = [];
  const github: GithubCall = async (options) => {
    const method = options.method ?? "GET";
    const key = `${method} ${options.route}`;
    const entry = routes[key];

    calls.push({ method, route: options.route, body: options.body });

    if (entry === undefined) {
      throw new Error(`Unexpected GitHub call: ${key}`);
    }

    return typeof entry === "function" ? entry(options.body) : entry;
  };

  return { github, calls };
}

export function sampleConfig(overrides: Partial<CloneConfigInput> = {}): CloneConfig {
  return cloneConfigSchema.parse({
    version: 2,
    repository: "sample/project",
    repositoryId: 7,
    defaultBranch: "main",
    visibility: "private",
    ownerId: 11,
    ownerLogin: "sample",
    skillsRepository: "sample/shadowclone-skills",
    provider: "claude-subscription",
    ...overrides,
  });
}

export const sha = (letter: string): string => letter.repeat(40);

export function issueRoute(options: {
  readonly number: number;
  readonly state?: string;
  readonly pull?: boolean;
}): FakeRoutes {
  return {
    [`GET repos/sample/project/issues/${options.number}`]: {
      status: 200,
      data: {
        number: options.number,
        state: options.state ?? "open",
        ...(options.pull ? { pull_request: { url: "pull" } } : {}),
      },
    },
  };
}

export function pullRoute(options: {
  readonly number: number;
  readonly branch: string;
  readonly head: string;
  readonly authorId?: number;
  readonly repositoryId?: number;
}): FakeRoutes {
  return {
    [`GET repos/sample/project/pulls/${options.number}`]: {
      status: 200,
      data: {
        number: options.number,
        state: "open",
        user: { id: options.authorId ?? 11 },
        head: { ref: options.branch, sha: options.head, repo: { id: options.repositoryId ?? 7 } },
      },
    },
  };
}

export async function temporaryClones(configs: readonly CloneConfig[] = [sampleConfig()]): Promise<{
  readonly paths: ClonesPaths;
  readonly remove: () => Promise<void>;
}> {
  const home = await realpath(await mkdtemp(path.join(os.tmpdir(), "shadowclone-clones-")));
  const paths = clonesPaths(home);

  for (const config of configs) {
    await saveCloneConfig({ paths, config });
  }

  return { paths, remove: () => rm(home, { recursive: true, force: true }) };
}
