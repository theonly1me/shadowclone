import type { GithubCall } from "./github";
import { sessionConfigSchema, type SessionConfig, type SessionConfigInput } from "./session/config";
import { sessionRefName } from "./state/sessionRef";

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

export function sampleConfig(overrides: Partial<SessionConfigInput> = {}): SessionConfig {
  return sessionConfigSchema.parse({
    version: 1,
    repository: "sample/project",
    repositoryId: 7,
    defaultBranch: "main",
    visibility: "private",
    ownerId: 11,
    ownerLogin: "sample",
    skillsRepository: "sample/shadowclone-skills",
    provider: "claude-subscription",
    host: "local",
    ...overrides,
  });
}

export const sha = (letter: string): string => letter.repeat(40);

export const owner = { id: 11, login: "sample", type: "User" };

export const collaborator = { id: 12, login: "helper", type: "User" };

export const reviewerBot = { id: 13, login: "coderabbitai[bot]", type: "Bot" };

export function issueRoutes(options: {
  readonly number: number;
  readonly labels?: readonly string[];
  readonly pull?: boolean;
}): FakeRoutes {
  return {
    [`GET repos/sample/project/issues/${options.number}`]: {
      status: 200,
      data: {
        number: options.number,
        state: "open",
        labels: (options.labels ?? []).map((name) => ({ name })),
        ...(options.pull ? { pull_request: { url: "pull" } } : {}),
      },
    },
  };
}

export function pullRoutes(options: {
  readonly number: number;
  readonly branch: string;
  readonly head: string;
  readonly labels?: readonly string[];
  readonly authorId?: number;
  readonly repositoryId?: number;
}): FakeRoutes {
  return {
    ...issueRoutes({ number: options.number, labels: options.labels, pull: true }),
    [`GET repos/sample/project/pulls/${options.number}`]: {
      status: 200,
      data: {
        number: options.number,
        state: "open",
        user: { id: options.authorId ?? 11 },
        labels: (options.labels ?? []).map((name) => ({ name })),
        head: { ref: options.branch, sha: options.head, repo: { id: options.repositoryId ?? 7 } },
      },
    },
  };
}

export function sessionHeadRoute(options: {
  readonly branch: string;
  readonly head: string | null;
}): FakeRoutes {
  const name = sessionRefName(options.branch);

  return {
    [`GET repos/sample/project/git/ref/${name.slice("refs/".length)}`]:
      options.head === null
        ? { status: 404, data: null }
        : { status: 200, data: { ref: name, object: { sha: options.head } } },
  };
}

export function issueCommentRoute(options: {
  readonly id: number;
  readonly entity: number;
  readonly user: { readonly id: number; readonly login: string; readonly type: string };
  readonly body: string;
}): FakeRoutes {
  return {
    [`GET repos/sample/project/issues/comments/${options.id}`]: {
      status: 200,
      data: {
        id: options.id,
        body: options.body,
        user: options.user,
        updated_at: "2026-10-14T10:00:00Z",
        issue_url: `https://api.github.com/repos/sample/project/issues/${options.entity}`,
      },
    },
  };
}
