import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fakeGithub, pullRoute, sampleConfig, sha, type FakeRoutes } from "../fixtures";
import type { Progress } from "../node/progress";
import type { CloneRequest } from "../node/request";
import { runClone } from ".";
import type { ProcessRequest, Processes } from "./processes";

const branch = "shadowclone/clone000";

const newTask: CloneRequest = {
  version: 1,
  id: "clone000",
  repository: "sample/project",
  createdAt: "2026-10-18T12:00:00Z",
  kind: "work",
  task: "fix the parser",
  target: { kind: "new" },
};

function pullRequestRoutes(): FakeRoutes {
  return {
    [`GET repos/sample/project/pulls?state=open&head=${encodeURIComponent(`sample:${branch}`)}&per_page=100`]:
      { status: 200, data: [{ number: 40, body: "Fixes the parser.", head: { ref: branch } }] },
    "POST repos/sample/project/issues/40/labels": { status: 200, data: [] },
    "PATCH repos/sample/project/pulls/40": { status: 200, data: {} },
  };
}

function fakeProcesses(options: { readonly unpushed: boolean }) {
  const commands: string[] = [];
  const streamed: ProcessRequest[] = [];
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
      streamed.push(request);
      return { exitCode: 0, tail: "Done." };
    },
  };

  return { processes, commands, streamed };
}

async function runWith(options: {
  readonly request: CloneRequest;
  readonly routes: FakeRoutes;
  readonly unpushed: boolean;
  readonly aborted: boolean;
}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "shadowclone-clone-"));
  const github = fakeGithub(options.routes);
  const { processes, commands, streamed } = fakeProcesses({ unpushed: options.unpushed });
  const reports: Progress[] = [];

  try {
    const final = await runClone({
      config: sampleConfig(),
      request: options.request,
      github: github.github,
      processes,
      root,
      environment: {},
      signal: options.aborted ? AbortSignal.abort() : new AbortController().signal,
      report: (progress) => reports.push(progress),
    });

    return { final, reports, github, commands, streamed };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("a clone run in the container", () => {
  test("a new task runs Claude Code on its own branch, then labels the pull request and adds the body line", async () => {
    const { final, reports, github, streamed } = await runWith({
      request: newTask,
      routes: pullRequestRoutes(),
      unpushed: false,
      aborted: false,
    });
    const [engine] = streamed;

    expect(engine?.arguments.slice(0, 4)).toEqual([
      "claude",
      "-p",
      "--permission-mode",
      "bypassPermissions",
    ]);
    expect(engine?.input).toContain("fix the parser");
    expect(engine?.input).toContain(`Work on the branch ${branch}.`);
    expect(final).toEqual({
      state: "done",
      branch,
      engine: "claude",
      pull: 40,
      detail: "The clone finished.",
    });
    expect(reports.at(-1)).toEqual(final);
    expect(
      github.calls.find((call) => call.route === "repos/sample/project/pulls/40")?.body,
    ).toEqual({ body: "Fixes the parser.\n\nMade by a shadowclone clone for @sample." });
  });

  test("a stopped clone pushes the unfinished work and reports stopped", async () => {
    const { final, commands } = await runWith({
      request: newTask,
      routes: pullRequestRoutes(),
      unpushed: true,
      aborted: true,
    });

    expect(commands).toContain(`git push --quiet origin HEAD:refs/heads/${branch}`);
    expect(final).toMatchObject({
      state: "stopped",
      detail:
        "The clone stopped before it finished, from a stop request or its time limit. The unfinished work is on the branch.",
    });
  });

  test("work on a fork pull request is refused before anything is cloned", async () => {
    const { final, commands } = await runWith({
      request: { ...newTask, target: { kind: "pull", number: 9 } },
      routes: pullRoute({ number: 9, branch: "feature", head: sha("c"), repositoryId: 99 }),
      unpushed: false,
      aborted: false,
    });

    expect(final).toEqual({
      state: "failed",
      engine: "claude",
      detail: "A clone cannot push to a fork. Start a review of the pull request instead.",
    });
    expect(commands.filter((command) => command.startsWith("git clone"))).toEqual([]);
  });
});
