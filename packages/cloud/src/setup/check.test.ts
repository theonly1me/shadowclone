import { expect, test } from "bun:test";
import { fixtureClone } from "../fixtures";
import { runCloneCheck } from "./check";
import { checkText, nextStepsText } from "./checklistText";
import { readCloudChecklist } from "./checklist";
import { ghApiFixture } from "./fixtures";
import type { GhResponse } from "./ghApi";

const startedAt = Date.parse("2026-10-13T10:00:00Z");
const workflow = "repos/sample/project/actions/workflows/shadowclone-check.yml";

function readyRepository(options: {
  readonly secrets?: readonly string[];
  readonly runs?: () => GhResponse;
  readonly dispatchStatus?: number;
}) {
  return ghApiFixture({
    "GET repos/sample/project/environments/shadowclone": { status: 200, data: { id: 77 } },
    "GET repos/sample/project/environments/shadowclone/secrets?per_page=100": {
      status: 200,
      data: {
        secrets: (options.secrets ?? ["SHADOWCLONE_BOT_TOKEN", "ANTHROPIC_API_KEY", "SHADOWCLONE_SKILLS_KEY"])
          .map((name) => ({ name })),
      },
    },
    "GET repos/sample/project/contents/.github/workflows/shadowclone-relay.yml?ref=main": { status: 200, data: null },
    "GET repos/sample/project/collaborators/sample-shadow": { status: 404, data: null },
    "GET repos/sample/project/invitations?per_page=100": { status: 200, data: [{ invitee: { login: "sample-shadow" } }] },
    [`POST ${workflow}/dispatches`]: { status: options.dispatchStatus ?? 204, data: null },
    [`GET ${workflow}/runs?event=workflow_dispatch&per_page=5`]: options.runs ?? { status: 200, data: { workflow_runs: [] } },
    "GET repos/sample/project/actions/runs/42/jobs": {
      status: 200,
      data: { jobs: [{ steps: [{ name: "Set up job", conclusion: "success" }, { name: "Use the anthropic API key", conclusion: "failure" }] }] },
    },
  });
}

function run(options: { readonly id: number; readonly createdAt: string; readonly conclusion: string | null }) {
  return {
    id: options.id,
    created_at: options.createdAt,
    status: options.conclusion === null ? "in_progress" : "completed",
    conclusion: options.conclusion,
    html_url: `https://github.com/sample/project/actions/runs/${options.id}`,
  };
}

function clock() {
  let current = startedAt;

  return { now: () => current, sleep: async (milliseconds: number) => { current += milliseconds; } };
}

test("the check waits for the keys and the merge before it starts a run", async () => {
  const { call, calls } = readyRepository({ secrets: ["SHADOWCLONE_SKILLS_KEY"] });
  const check = await runCloneCheck({ clone: fixtureClone, call, pullUrl: null, limitMilliseconds: 8 * 60_000, ...clock() });

  expect(check.kind).toBe("not-ready");
  expect(calls.some((request) => request.method === "POST")).toBeFalse();
  expect(checkText(check)).toContain("[ ] Token for sample-shadow");
  expect(checkText(check)).toContain("[ ] Anthropic API key");
});

test("the check starts a run on the default branch and reports the run that started after it", async () => {
  const { call, calls } = readyRepository({
    runs: () => ({
      status: 200,
      data: {
        workflow_runs: [
          run({ id: 41, createdAt: "2026-10-13T10:00:05Z", conclusion: "success" }),
          run({ id: 40, createdAt: "2026-10-13T09:00:00Z", conclusion: "failure" }),
        ],
      },
    }),
  });
  const check = await runCloneCheck({ clone: fixtureClone, call, pullUrl: null, limitMilliseconds: 8 * 60_000, ...clock() });

  expect(calls.find((request) => request.method === "POST")?.body).toEqual({ ref: "main" });
  expect(check).toEqual({ kind: "passed", url: "https://github.com/sample/project/actions/runs/41" });
  expect(checkText(check)).toBe(
    "The bot is ready. The check run accepted the invitation and used the API key: https://github.com/sample/project/actions/runs/41",
  );
});

test("a failed check names the step that failed", async () => {
  const { call } = readyRepository({
    runs: () => ({ status: 200, data: { workflow_runs: [run({ id: 42, createdAt: "2026-10-13T10:00:05Z", conclusion: "failure" })] } }),
  });
  const check = await runCloneCheck({ clone: fixtureClone, call, pullUrl: null, limitMilliseconds: 8 * 60_000, ...clock() });

  expect(checkText(check)).toBe(
    'The check run failed at "Use the anthropic API key": https://github.com/sample/project/actions/runs/42',
  );
});

test("an old run alone does not count, and the check returns after its time limit", async () => {
  const { call } = readyRepository({
    runs: () => ({ status: 200, data: { workflow_runs: [run({ id: 40, createdAt: "2026-10-13T09:00:00Z", conclusion: "success" })] } }),
  });
  const check = await runCloneCheck({ clone: fixtureClone, call, pullUrl: null, limitMilliseconds: 8 * 60_000, ...clock() });

  expect(check).toEqual({ kind: "running", url: null });
  expect(checkText(check)).toBe("The check run is still running. Check the status again to wait for it.");
});

test("a check while a run is in progress waits for that run and starts no new run", async () => {
  let polls = 0;
  const { call, calls } = readyRepository({
    runs: () => {
      polls += 1;

      return {
        status: 200,
        data: { workflow_runs: [run({ id: 42, createdAt: "2026-10-13T09:58:00Z", conclusion: polls < 3 ? null : "success" })] },
      };
    },
  });
  const check = await runCloneCheck({ clone: fixtureClone, call, pullUrl: null, limitMilliseconds: 8 * 60_000, ...clock() });

  expect(check).toEqual({ kind: "passed", url: "https://github.com/sample/project/actions/runs/42" });
  expect(calls.some((request) => request.method === "POST")).toBeFalse();
});

test("a check before the setup pull request merges stops with the next step", async () => {
  const { call } = readyRepository({ dispatchStatus: 404 });

  await expect(runCloneCheck({ clone: fixtureClone, call, pullUrl: null, limitMilliseconds: 8 * 60_000, ...clock() })).rejects.toThrow(
    "GitHub refused to start the check run (HTTP 404). Merge the setup pull request first.",
  );
});

test("the next steps give one environment link for both secrets, the setup pull request, and the status command", async () => {
  const { call } = readyRepository({ secrets: ["SHADOWCLONE_SKILLS_KEY"] });
  const checklist = await readCloudChecklist({ call, clone: fixtureClone, pullUrl: "https://github.com/sample/project/pull/5" });

  expect(nextStepsText({
    repository: "sample/project",
    environmentUrl: "https://github.com/sample/project/settings/environments/77/edit",
    pullUrl: "https://github.com/sample/project/pull/5",
    checklist,
  })).toBe([
    "1. Add Token for sample-shadow and Anthropic API key on the shadowclone environment page:",
    "   https://github.com/sample/project/settings/environments/77/edit",
    "   Token for sample-shadow: Create the token: https://github.com/settings/tokens/new?scopes=repo&description=shadowclone+sample%2Fproject",
    "   Anthropic API key: Create the key in the Claude Console: https://platform.claude.com/settings/keys",
    "2. Merge the setup pull request:",
    "   https://github.com/sample/project/pull/5",
    "3. Then run: shadowclone bot status --repo sample/project",
  ].join("\n"));
});
