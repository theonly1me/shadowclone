import { expect, test } from "bun:test";
import { fakeGithub, type FakeRoutes } from "../fixtures";
import { prepareClones } from "./prepare";

function routes(permissions: { readonly admin: boolean; readonly push: boolean }): FakeRoutes {
  return {
    "GET user": { status: 200, data: { id: 11, login: "sample" } },
    "GET repos/sample/project": {
      status: 200,
      data: {
        id: 7,
        full_name: "sample/project",
        default_branch: "main",
        visibility: "private",
        owner: { type: "Organization" },
        permissions,
      },
    },
    "GET repos/sample/shadowclone-skills": { status: 200, data: {} },
  };
}

const request = {
  repository: "sample/project",
  provider: "claude-subscription",
  attribution: true,
} as const;

test("setup on a repository that the owner can push to but does not administer leaves its rulesets alone", async () => {
  const { github, calls } = fakeGithub(routes({ admin: false, push: true }));

  const prepared = await prepareClones({ ...request, github });

  expect(prepared.kind).toBe("ready");
  expect(calls.map((call) => `${call.method} ${call.route}`)).toEqual([
    "GET user",
    "GET repos/sample/project",
    "GET repos/sample/shadowclone-skills",
  ]);
});

test("setup refuses a repository that the owner cannot push to", async () => {
  const { github } = fakeGithub(routes({ admin: false, push: false }));

  await expect(prepareClones({ ...request, github })).rejects.toThrow(
    "Setup needs write access to sample/project, because each clone pushes its branch there.",
  );
});
