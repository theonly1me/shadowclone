import { expect, test } from "bun:test";
import { eventContext, fixtureClone, fixtureIssue, githubFixture, ownerPermission } from "../fixtures";
import { resolveTrigger } from "./events";

const ownerPull = {
  number: 2,
  state: "open",
  draft: false,
  user: { login: "sample" },
  head: { ref: "feature/total", sha: "b".repeat(40), repo: { id: fixtureClone.repositoryId } },
  labels: [],
};

function commentOnPull(body: string) {
  return githubFixture({
    "GET /repos/sample/project/issues/comments/4": {
      user: { login: "sample", type: "User" },
      body,
      issue_url: "https://api.github.com/repos/sample/project/issues/2",
      updated_at: "v1",
    },
    "GET /repos/sample/project/issues/2": { ...fixtureIssue, number: 2, pull_request: { url: "synthetic" } },
    "GET /repos/sample/project/pulls/2": ownerPull,
    ...ownerPermission,
  });
}

const commentContext = eventContext({ event: "issue_comment", payload: { comment: { id: 4 } } });

test("a first-line review command on a pull request starts a review, not work", async () => {
  const { request } = commentOnPull("@sample-shadow review\nThe totals changed.");

  const trigger = await resolveTrigger({ clone: fixtureClone, context: commentContext, request });

  expect([trigger?.kind, trigger?.entity, trigger?.head]).toEqual(["review", 2, "b".repeat(40)]);
});

test("a review command on a fork pull request starts a review without the fork's toolchain", async () => {
  const { request } = githubFixture({
    "GET /repos/sample/project/issues/comments/4": {
      user: { login: "sample", type: "User" },
      body: "@sample-shadow review",
      issue_url: "https://api.github.com/repos/sample/project/issues/2",
      updated_at: "v1",
    },
    "GET /repos/sample/project/issues/2": { ...fixtureIssue, number: 2, pull_request: { url: "synthetic" } },
    "GET /repos/sample/project/pulls/2": { ...ownerPull, head: { ...ownerPull.head, repo: { id: 999 } } },
    ...ownerPermission,
  });

  const trigger = await resolveTrigger({ clone: fixtureClone, context: commentContext, request });

  expect([trigger?.kind, trigger?.fork, trigger?.head]).toEqual(["review", true, "b".repeat(40)]);
});

test("any other tagged request on a pull request still starts work", async () => {
  const { request } = commentOnPull("@sample-shadow review the totals and fix them");

  expect((await resolveTrigger({ clone: fixtureClone, context: commentContext, request }))?.kind).toBe("pull");
});

test("a review command on an issue starts nothing", async () => {
  const { request } = githubFixture({
    "GET /repos/sample/project/issues/comments/4": {
      user: { login: "sample", type: "User" },
      body: "@sample-shadow review",
      issue_url: "https://api.github.com/repos/sample/project/issues/1",
      updated_at: "v1",
    },
    "GET /repos/sample/project/issues/1": fixtureIssue,
    ...ownerPermission,
  });

  expect(await resolveTrigger({ clone: fixtureClone, context: commentContext, request })).toBeNull();
});

test("a pull request that opens or becomes ready starts no review until someone tags the bot", async () => {
  const { request } = githubFixture({
    "GET /repos/sample/project/pulls/2": ownerPull,
    "GET /repos/sample/project/issues/2": { ...fixtureIssue, number: 2, pull_request: { url: "synthetic" } },
    ...ownerPermission,
  });

  for (const action of ["opened", "ready_for_review", "synchronize"]) {
    const context = eventContext({
      event: "pull_request_target",
      payload: { action, pull_request: { number: 2 }, issue: undefined },
    });

    expect(await resolveTrigger({ clone: fixtureClone, context, request })).toBeNull();
  }
});
