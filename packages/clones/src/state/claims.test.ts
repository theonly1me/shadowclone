import { describe, expect, test } from "bun:test";
import { fakeGithub, sampleConfig, sha, type GithubCallRecord } from "../fixtures";
import type { SessionRequest } from "../trigger/event";
import { claimRequest } from "./claims";
import { shortHash } from "./sessionRef";

const config = sampleConfig({ maximumRuns: 2 });
const now = new Date("2026-10-14T12:00:00Z");
const request: SessionRequest = {
  kind: "work",
  source: "issue_comment",
  identifier: 501,
  entity: 12,
  pull: false,
  branch: "shadowclone/issue-12",
  head: "",
  ownerAuthored: true,
  fork: false,
  key: "issue_comment:501:2026-10-14T10:00:00Z",
  task: "",
};
const branchHash = shortHash(request.branch);

function claimGithub(options: {
  readonly existing: readonly string[];
  readonly createStatus: number;
}) {
  return fakeGithub({
    "GET repos/sample/project/git/matching-refs/shadowclone/claims/": {
      status: 200,
      data: options.existing.map((ref) => ({ ref, object: { sha: sha("a") } })),
    },
    "GET repos/sample/project/git/ref/heads/main": {
      status: 200,
      data: { object: { sha: sha("a") } },
    },
    "POST repos/sample/project/git/refs": { status: options.createStatus, data: {} },
    "DELETE repos/sample/project/git/refs/shadowclone/claims/2026-10-01/aaaaaaaaaaaaaaaa/bbbbbbbbbbbbbbbb":
      { status: 204, data: null },
  });
}

function created(calls: readonly GithubCallRecord[]): unknown {
  return calls.find((call) => call.method === "POST")?.body;
}

describe("claims", () => {
  test("a new request creates one claim ref under today's date and the branch hash", async () => {
    const { github, calls } = claimGithub({ existing: [], createStatus: 201 });

    expect(await claimRequest({ github, config, request, now })).toEqual({ kind: "claimed" });
    expect(created(calls)).toEqual({
      ref: `refs/shadowclone/claims/2026-10-14/${branchHash}/${shortHash(request.key)}`,
      sha: sha("a"),
    });
  });

  test("a request that another host already claimed does not run again", async () => {
    const { github } = claimGithub({ existing: [], createStatus: 422 });

    expect(await claimRequest({ github, config, request, now })).toEqual({ kind: "duplicate" });
  });

  test("a branch that used its daily runs gets no new claim", async () => {
    const { github, calls } = claimGithub({
      existing: [
        `refs/shadowclone/claims/2026-10-14/${branchHash}/1111111111111111`,
        `refs/shadowclone/claims/2026-10-14/${branchHash}/2222222222222222`,
      ],
      createStatus: 201,
    });

    expect(await claimRequest({ github, config, request, now })).toEqual({
      kind: "over-budget",
      scope: "branch",
    });
    expect(created(calls)).toBeUndefined();
  });

  test("claims older than yesterday are deleted and do not count", async () => {
    const { github, calls } = claimGithub({
      existing: [`refs/shadowclone/claims/2026-10-01/aaaaaaaaaaaaaaaa/bbbbbbbbbbbbbbbb`],
      createStatus: 201,
    });

    expect(await claimRequest({ github, config, request, now })).toEqual({ kind: "claimed" });
    expect(calls.filter((call) => call.method === "DELETE").map((call) => call.route)).toEqual([
      "repos/sample/project/git/refs/shadowclone/claims/2026-10-01/aaaaaaaaaaaaaaaa/bbbbbbbbbbbbbbbb",
    ]);
  });
});
