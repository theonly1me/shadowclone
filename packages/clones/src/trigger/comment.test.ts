import { describe, expect, test } from "bun:test";
import {
  collaborator,
  fakeGithub,
  issueCommentRoute,
  issueRoutes,
  owner,
  pullRoutes,
  reviewerBot,
  sampleConfig,
  sessionHeadRoute,
  sha,
} from "../fixtures";
import { resolveSessionRequest } from ".";

const config = sampleConfig();
const now = new Date("2026-10-14T12:00:00Z");

async function resolveIssueComment(options: {
  readonly user: typeof owner;
  readonly body: string;
  readonly labels?: readonly string[];
}) {
  const { github } = fakeGithub({
    ...issueCommentRoute({ id: 501, entity: 12, user: options.user, body: options.body }),
    ...issueRoutes({ number: 12, labels: options.labels }),
  });

  return resolveSessionRequest({
    github,
    config,
    now,
    event: { kind: "comment", source: "issue_comment", id: 501, entity: 12 },
  });
}

describe("who starts a session", () => {
  test("the owner's /shadowclone comment starts work on the issue branch with the task text", async () => {
    const resolution = await resolveIssueComment({
      user: owner,
      body: "/shadowclone fix the parser\nKeep the API.",
    });

    expect(resolution).toMatchObject({
      kind: "accepted",
      request: {
        kind: "work",
        entity: 12,
        branch: "shadowclone/issue-12",
        task: "fix the parser\nKeep the API.",
        pull: false,
      },
    });
  });

  test("a collaborator's /shadowclone comment starts nothing", async () => {
    const resolution = await resolveIssueComment({
      user: collaborator,
      body: "/shadowclone fix the parser",
    });

    expect(resolution.kind).toBe("ignored");
  });

  test("an account that copies the owner's login but has another ID starts nothing", async () => {
    const resolution = await resolveIssueComment({
      user: { ...collaborator, login: "sample" },
      body: "/shadowclone fix it",
    });

    expect(resolution.kind).toBe("ignored");
  });

  test("the owner's comment without the command starts nothing", async () => {
    const resolution = await resolveIssueComment({
      user: owner,
      body: "Please look at /shadowclone later",
    });

    expect(resolution.kind).toBe("ignored");
  });

  test("a paused issue starts nothing", async () => {
    const resolution = await resolveIssueComment({
      user: owner,
      body: "/shadowclone go",
      labels: ["shadowclone:paused"],
    });

    expect(resolution).toEqual({ kind: "ignored", reason: "The work is paused." });
  });

  test("a comment whose issue URL names another repository starts nothing", async () => {
    const { github } = fakeGithub({
      "GET repos/sample/project/issues/comments/501": {
        status: 200,
        data: {
          id: 501,
          body: "/shadowclone go",
          user: owner,
          issue_url: "https://api.github.com/repos/other/project/issues/12",
        },
      },
    });

    const resolution = await resolveSessionRequest({
      github,
      config,
      now,
      event: { kind: "comment", source: "issue_comment", id: 501, entity: 12 },
    });

    expect(resolution.kind).toBe("ignored");
  });
});

describe("pull requests", () => {
  const prComment = (options: {
    readonly user: typeof owner;
    readonly body: string;
    readonly labels?: readonly string[];
    readonly repositoryId?: number;
    readonly sessionHead?: string | null;
  }) =>
    fakeGithub({
      ...issueCommentRoute({ id: 502, entity: 30, user: options.user, body: options.body }),
      ...pullRoutes({
        number: 30,
        branch: "feature",
        head: sha("a"),
        labels: options.labels,
        repositoryId: options.repositoryId,
      }),
      ...sessionHeadRoute({ branch: "feature", head: options.sessionHead ?? null }),
    }).github;
  const event = { kind: "comment", source: "issue_comment", id: 502, entity: 30 } as const;

  test("/shadowclone review on a fork pull request is a review of the fork head", async () => {
    const github = prComment({ user: owner, body: "/shadowclone review", repositoryId: 99 });

    expect(await resolveSessionRequest({ github, config, event, now })).toMatchObject({
      kind: "accepted",
      request: { kind: "review", fork: true, head: sha("a"), branch: "feature" },
    });
  });

  test("work on a fork pull request is refused because a session cannot push there", async () => {
    const github = prComment({ user: owner, body: "/shadowclone fix it", repositoryId: 99 });

    expect(await resolveSessionRequest({ github, config, event, now })).toEqual({
      kind: "ignored",
      reason: "A session cannot push to a fork.",
    });
  });

  test("an allowed reviewer bot continues a session pull request", async () => {
    const github = prComment({
      user: reviewerBot,
      body: "Nit: rename this.",
      labels: ["shadowclone"],
      sessionHead: sha("a"),
    });

    expect(await resolveSessionRequest({ github, config, event, now })).toMatchObject({
      kind: "accepted",
      request: { kind: "continue" },
    });
  });

  test("an allowed reviewer bot on a pull request that no session made starts nothing", async () => {
    const github = prComment({ user: reviewerBot, body: "Nit: rename this." });

    expect((await resolveSessionRequest({ github, config, event, now })).kind).toBe("ignored");
  });
});
