import { describe, expect, test } from "bun:test";
import { fakeGithub, issueCommentRoute, issueRoutes, owner, sampleConfig } from "../fixtures";
import { renderStatus } from "../state/statusComment";
import { resolveSessionRequest } from ".";

const config = sampleConfig();
const now = new Date("2026-10-14T12:00:00Z");

function withStatus(updatedAt: string) {
  return fakeGithub({
    ...issueCommentRoute({ id: 501, entity: 12, user: owner, body: "/shadowclone fix it" }),
    ...issueRoutes({ number: 12 }),
    "GET repos/sample/project/issues/12/comments?per_page=100&page=1": {
      status: 200,
      data: [
        {
          id: 700,
          user: { id: 11 },
          body: renderStatus({
            state: "working",
            key: "issue_comment:400:x",
            kind: "work",
            branch: "shadowclone/issue-12",
            engine: "claude",
            pull: null,
            startedAt: updatedAt,
            updatedAt,
            detail: "",
          }),
        },
      ],
    },
  }).github;
}

const event = { kind: "comment", source: "issue_comment", id: 501, entity: 12 } as const;

describe("a session that is already working", () => {
  test("a /shadowclone comment that the agent posts as the owner during a session starts nothing", async () => {
    const github = withStatus("2026-10-14T11:00:00Z");

    expect(await resolveSessionRequest({ github, config, event, now })).toEqual({
      kind: "ignored",
      reason: "A session is already working on this issue or pull request.",
    });
  });

  test("a working status older than three hours no longer blocks the owner", async () => {
    const github = withStatus("2026-10-14T08:00:00Z");

    expect((await resolveSessionRequest({ github, config, event, now })).kind).toBe("accepted");
  });
});
