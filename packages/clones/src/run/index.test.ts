import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fakeGithub, issueCommentRoute, issueRoutes, owner, sampleConfig, sha } from "../fixtures";
import { parseStatus } from "../state/statusComment";
import { runSession } from ".";
import type { ProcessRequest, Processes } from "./processes";

const roots: string[] = [];
const branch = "shadowclone/issue-12";

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function bodyText(body: unknown): string {
  return typeof body === "object" && body !== null && "body" in body ? String(body.body) : "";
}

function sessionGithub() {
  const comments: { id: number; body: string; user: { id: number } }[] = [];
  const fake = fakeGithub({
    ...issueCommentRoute({ id: 501, entity: 12, user: owner, body: "/shadowclone fix the parser" }),
    ...issueRoutes({ number: 12 }),
    "GET repos/sample/project/git/matching-refs/shadowclone/claims/": { status: 200, data: [] },
    "GET repos/sample/project/git/ref/heads/main": {
      status: 200,
      data: { object: { sha: sha("a") } },
    },
    "POST repos/sample/project/git/refs": { status: 201, data: {} },
    "POST repos/sample/project/issues/comments/501/reactions": { status: 201, data: {} },
    "GET repos/sample/project/issues/12/comments?per_page=100&page=1": () => ({
      status: 200,
      data: comments,
    }),
    "POST repos/sample/project/issues/12/comments": (body) => {
      comments.push({ id: 700, body: bodyText(body), user: { id: 11 } });
      return { status: 201, data: {} };
    },
    "PATCH repos/sample/project/issues/comments/700": (body) => {
      const [first] = comments;

      if (first) {
        first.body = bodyText(body);
      }

      return { status: 200, data: {} };
    },
    [`GET repos/sample/project/pulls?state=open&head=${encodeURIComponent(`sample:${branch}`)}&per_page=100`]:
      {
        status: 200,
        data: [{ number: 40, body: "Fixes the parser.", head: { ref: branch } }],
      },
    "POST repos/sample/project/issues/40/labels": { status: 200, data: [] },
    "PATCH repos/sample/project/pulls/40": { status: 200, data: {} },
  });

  return { ...fake, comments };
}

function fakeProcesses(options: {
  readonly unpushed: boolean;
  readonly onStream: (request: ProcessRequest) => void;
}) {
  const commands: string[] = [];
  const processes: Processes = {
    run: async (request) => {
      const command = request.arguments.join(" ");

      commands.push(command);

      if (request.arguments[1] === "clone") {
        await mkdir(path.join(request.arguments.at(-1) ?? "", ".git", "hooks"), {
          recursive: true,
        });
      }

      const outputs: Record<string, { exitCode: number; stdout: string }> = {
        [`git ls-remote --exit-code --heads origin ${branch}`]: { exitCode: 2, stdout: "" },
        "git branch --show-current": { exitCode: 0, stdout: `${branch}\n` },
        [`git rev-parse --verify --quiet origin/${branch}`]: { exitCode: 0, stdout: sha("b") },
        [`git rev-list --count origin/${branch}..HEAD`]: {
          exitCode: 0,
          stdout: options.unpushed ? "1\n" : "0\n",
        },
        [`git ls-remote --heads origin refs/heads/${branch}`]: {
          exitCode: 0,
          stdout: `${sha("b")}\trefs/heads/${branch}\n`,
        },
      };

      return { stderr: "", ...(outputs[command] ?? { exitCode: 0, stdout: "" }) };
    },
    stream: async (request) => {
      options.onStream(request);
      return { exitCode: 0, tail: "Done." };
    },
  };

  return { processes, commands };
}

async function start(options: { readonly unpushed: boolean; readonly aborted: boolean }) {
  const root = await mkdtemp(path.join(os.tmpdir(), "shadowclone-session-"));
  const github = sessionGithub();
  const streamed: ProcessRequest[] = [];
  const { processes, commands } = fakeProcesses({
    unpushed: options.unpushed,
    onStream: (request) => streamed.push(request),
  });
  const controller = new AbortController();

  roots.push(root);

  if (options.aborted) {
    controller.abort();
  }

  const outcome = await runSession({
    config: sampleConfig(),
    github: github.github,
    processes,
    root,
    environment: {},
    signal: controller.signal,
    now: () => new Date("2026-10-14T12:00:00Z"),
    event: { kind: "comment", source: "issue_comment", id: 501, entity: 12 },
  });

  return { outcome, github, streamed, commands };
}

describe("a session from the owner's comment", () => {
  test("runs Claude Code on the task, marks the pull request, and records the pushed head", async () => {
    const { outcome, github, streamed } = await start({ unpushed: false, aborted: false });
    const [engine] = streamed;

    expect(engine?.arguments.slice(0, 4)).toEqual([
      "claude",
      "-p",
      "--permission-mode",
      "bypassPermissions",
    ]);
    expect(engine?.input).toContain("fix the parser");
    expect(outcome).toMatchObject({ kind: "finished", status: { state: "done", pull: 40 } });
    expect(
      github.calls.find((call) => call.route === "repos/sample/project/pulls/40")?.body,
    ).toEqual({
      body: "Fixes the parser.\n\nMade in a shadowclone session for @sample.",
    });
    expect(
      github.calls
        .filter((call) => call.method === "POST" && call.route === "repos/sample/project/git/refs")
        .map((call) => call.body),
    ).toContainEqual({
      ref: expect.stringMatching(/^refs\/shadowclone\/sessions\/[a-f0-9]{16}$/),
      sha: sha("b"),
    });
    expect(parseStatus(github.comments[0]?.body ?? "")?.state).toBe("done");
  });

  test("a session that the host stops pushes the unfinished work and says so in the status comment", async () => {
    const { outcome, commands, github } = await start({ unpushed: true, aborted: true });

    expect(commands).toContain(`git push --quiet origin HEAD:refs/heads/${branch}`);
    expect(outcome).toMatchObject({ kind: "finished", status: { state: "saved" } });
    expect(github.comments[0]?.body).toContain("The unfinished work is on the branch.");
  });
});
