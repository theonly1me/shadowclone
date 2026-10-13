import { describe, expect, test } from "bun:test";
import { fakeGithub, pullRoutes, sampleConfig, sessionHeadRoute, sha } from "../fixtures";
import { resolveSessionRequest } from ".";

const config = sampleConfig();
const branch = "shadowclone/issue-12";

function ciGithub(options: {
  readonly sessionHead: string | null;
  readonly runHead: string;
  readonly siblingStatus?: string;
}) {
  return fakeGithub({
    "GET repos/sample/project/actions/runs/900": {
      status: 200,
      data: {
        id: 900,
        status: "completed",
        conclusion: "failure",
        path: ".github/workflows/ci.yml",
        head_branch: branch,
        head_sha: options.runHead,
        head_repository: { id: 7 },
      },
    },
    ...sessionHeadRoute({ branch, head: options.sessionHead }),
    [`GET repos/sample/project/actions/runs?head_sha=${options.runHead}&per_page=100`]: {
      status: 200,
      data: {
        workflow_runs: [
          {
            id: 901,
            status: options.siblingStatus ?? "completed",
            conclusion: null,
            path: ".github/workflows/lint.yml",
            head_branch: branch,
            head_sha: options.runHead,
            head_repository: { id: 7 },
          },
        ],
      },
    },
    [`GET repos/sample/project/pulls?state=open&head=${encodeURIComponent(`sample:${branch}`)}&per_page=100`]:
      {
        status: 200,
        data: [{ number: 40, head: { ref: branch } }],
      },
    ...pullRoutes({ number: 40, branch, head: options.runHead, labels: ["shadowclone"] }),
    ...pullRoutes({ number: 12, branch: "unused", head: sha("f") }),
    "GET repos/sample/project/issues/12": {
      status: 200,
      data: { number: 12, state: "open", labels: [] },
    },
  }).github;
}

const event = { kind: "ci", runId: 900 } as const;

describe("CI continues a session", () => {
  test("a finished CI run on the commit that the session pushed last continues the session pull request", async () => {
    const github = ciGithub({ sessionHead: sha("a"), runHead: sha("a") });

    expect(await resolveSessionRequest({ github, config, event })).toMatchObject({
      kind: "accepted",
      request: { kind: "continue", entity: 40, branch, key: `workflow_run:${sha("a")}` },
    });
  });

  test("a CI run on a commit that the owner pushed by hand does not continue the session", async () => {
    const github = ciGithub({ sessionHead: sha("a"), runHead: sha("b") });

    expect(await resolveSessionRequest({ github, config, event })).toEqual({
      kind: "ignored",
      reason: "The session did not push this commit last.",
    });
  });

  test("a CI run waits while another run on the same commit is still running", async () => {
    const github = ciGithub({
      sessionHead: sha("a"),
      runHead: sha("a"),
      siblingStatus: "in_progress",
    });

    expect((await resolveSessionRequest({ github, config, event })).kind).toBe("ignored");
  });
});
