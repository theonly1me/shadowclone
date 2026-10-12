import { expect, test } from "bun:test";
import { resolveTrigger } from "./events";
import {
  collaboratorPermission,
  eventContext,
  fixtureClone,
  fixtureIssue,
  fixturePull,
  githubFixture,
  ownerPermission,
} from "../fixtures";

const issueRoute = "GET /repos/sample/project/issues/1";

function commentFixture(options: { readonly login: string; readonly body: string; readonly permission: string }) {
  return githubFixture({
    [issueRoute]: { ...fixtureIssue, body: "" },
    ...collaboratorPermission({ login: options.login, permission: options.permission }),
    "GET /repos/sample/project/issues/comments/4": {
      user: { login: options.login, type: "User" },
      body: options.body,
      issue_url: "https://api.github.com/repos/sample/project/issues/1",
      updated_at: "synthetic-version",
    },
  });
}

async function commentTrigger(options: { readonly login: string; readonly body: string; readonly permission: string }) {
  const { request } = commentFixture(options);
  const context = eventContext({ event: "issue_comment", actor: options.login, payload: { comment: { id: 4 } } });

  return resolveTrigger({ clone: fixtureClone, context, request });
}

test("an issue that tags the bot survives the default-branch relay dispatch", async () => {
  const { request } = githubFixture({ [issueRoute]: fixtureIssue, ...ownerPermission });
  const direct = await resolveTrigger({ clone: fixtureClone, context: eventContext(), request });

  expect(direct?.kind).toBe("issue");

  const dispatch = eventContext({
    event: "workflow_dispatch",
    actor: "github-actions[bot]",
    payload: { inputs: { ...direct, action: "opened", identifier: "1", entity: "1" } },
  });
  const resolved = await resolveTrigger({ clone: fixtureClone, context: dispatch, request });

  expect(resolved).toEqual(direct);
  expect(resolved?.actor).toBe("sample");
});

test("a tagged issue survives a relay dispatch when GitHub leaves out the empty head input", async () => {
  const { request } = githubFixture({ [issueRoute]: fixtureIssue, ...ownerPermission });
  const direct = await resolveTrigger({ clone: fixtureClone, context: eventContext(), request });
  const dispatch = eventContext({
    event: "workflow_dispatch",
    actor: "github-actions[bot]",
    payload: {
      inputs: { source: "issues", action: "opened", identifier: "1", entity: "1", branch: "shadowclone/issue-1", key: direct?.key },
    },
  });

  expect(direct?.head).toBe("");
  expect(await resolveTrigger({ clone: fixtureClone, context: dispatch, request })).toEqual(direct);
});

test("an issue that does not tag the bot starts nothing, even from the owner", async () => {
  for (const issue of [
    { ...fixtureIssue, body: "Please fix the parser." },
    { ...fixtureIssue, body: "Write to mail@sample-shadow.test about the parser." },
  ]) {
    const { request } = githubFixture({ [issueRoute]: issue, ...ownerPermission });

    expect(await resolveTrigger({ clone: fixtureClone, context: eventContext(), request })).toBeNull();
  }
});

test("a tagged issue title starts work like a tagged body", async () => {
  const { request } = githubFixture({
    [issueRoute]: { ...fixtureIssue, title: "@sample-shadow fix the parser", body: "" },
    ...ownerPermission,
  });

  expect((await resolveTrigger({ clone: fixtureClone, context: eventContext(), request }))?.kind).toBe("issue");
});

test("a tagged issue from a person without write access, or from another repository, starts nothing", async () => {
  const { request } = githubFixture({
    [issueRoute]: { ...fixtureIssue, user: { login: "outside" } },
    ...collaboratorPermission({ login: "outside", permission: "read" }),
  });
  const outside = eventContext({ actor: "outside" });

  expect(await resolveTrigger({ clone: fixtureClone, context: outside, request })).toBeNull();
  expect(
    await resolveTrigger({ clone: fixtureClone, context: eventContext({ payload: { repository: { id: 999 } } }), request }),
  ).toBeNull();
});

test("anyone with write, maintain, or admin access can tag the bot, and read or triage access cannot", async () => {
  const results: Record<string, string | null> = {};

  for (const permission of ["admin", "maintain", "write", "triage", "read", "none"]) {
    const trigger = await commentTrigger({ login: "teammate", body: "@sample-shadow fix the parser", permission });

    results[permission] = trigger?.key ?? null;
  }

  expect(results).toEqual({
    admin: "issue_comment:4:synthetic-version",
    maintain: "issue_comment:4:synthetic-version",
    write: "issue_comment:4:synthetic-version",
    triage: null,
    read: null,
    none: null,
  });
});

test("the bot answers only to its own login", async () => {
  const keys: (string | null)[] = [];

  for (const body of ["@sample-shadow: fix the parser", "@shadowclone fix the parser", "@sample-shadowx fix the parser"]) {
    keys.push((await commentTrigger({ login: "sample", body, permission: "admin" }))?.key ?? null);
  }

  expect(keys).toEqual(["issue_comment:4:synthetic-version", null, null]);
});

test("work requests reject the bot itself, other bots, and fork pull requests", async () => {
  for (const user of [
    { login: fixtureClone.botLogin, type: "User" },
    { login: "helper[bot]", type: "Bot" },
    { login: "sample", type: "User" },
  ]) {
    const { request } = githubFixture({
      ...collaboratorPermission({ login: user.login, permission: "write" }),
      "GET /repos/sample/project/issues/comments/4": {
        user,
        body: "@sample-shadow do work",
        issue_url: "https://api.github.com/repos/sample/project/issues/2",
        updated_at: "v1",
      },
      "GET /repos/sample/project/issues/2": { ...fixtureIssue, number: 2, pull_request: { url: "synthetic" } },
      "GET /repos/sample/project/pulls/2": { ...fixturePull, head: { ...fixturePull.head, repo: { id: 999 } } },
    });
    const context = eventContext({ event: "issue_comment", actor: user.login, payload: { comment: { id: 4 } } });

    expect(await resolveTrigger({ clone: fixtureClone, context, request })).toBeNull();
  }
});

test("a paused issue rejects work, and forged dispatch inputs cannot change branches", async () => {
  const { request } = githubFixture({
    [issueRoute]: { ...fixtureIssue, labels: [{ name: "shadowclone:paused" }] },
    ...ownerPermission,
  });

  expect(await resolveTrigger({ clone: fixtureClone, context: eventContext(), request })).toBeNull();

  const unpaused = githubFixture({ [issueRoute]: fixtureIssue, ...ownerPermission });
  const context = eventContext({
    event: "workflow_dispatch",
    payload: {
      inputs: { source: "issues", action: "opened", identifier: "1", entity: "1", branch: "main", head: "", key: "issues:1:" },
    },
  });

  expect(await resolveTrigger({ clone: fixtureClone, context, request: unpaused.request })).toBeNull();
});
