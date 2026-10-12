import { expect, test } from "bun:test";
import { fixtureClone } from "../fixtures";
import { readCloudChecklist } from "./checklist";
import { ghApiFixture } from "./fixtures";

function repositoryState(options: {
  readonly secrets: readonly string[];
  readonly merged: boolean;
  readonly collaborator: boolean;
}) {
  return ghApiFixture({
    "GET repos/sample/project/environments/shadowclone": { status: 200, data: { id: 77 } },
    "GET repos/sample/project/environments/shadowclone/secrets?per_page=100": {
      status: 200,
      data: { secrets: options.secrets.map((name) => ({ name })) },
    },
    "GET repos/sample/project/contents/.github/workflows/shadowclone-relay.yml?ref=main": {
      status: options.merged ? 200 : 404,
      data: null,
    },
    "GET repos/sample/project/collaborators/sample-shadow": {
      status: options.collaborator ? 204 : 404,
      data: null,
    },
    "GET repos/sample/project/invitations?per_page=100": {
      status: 200,
      data: [{ invitee: { login: "sample-shadow" } }],
    },
  });
}

test("a fresh setup lists the bot token and the API key to add on GitHub, with their source and environment pages", async () => {
  const { call } = repositoryState({
    secrets: ["SHADOWCLONE_SKILLS_KEY"],
    merged: false,
    collaborator: false,
  });
  const checklist = await readCloudChecklist({
    call,
    clone: fixtureClone,
    pullUrl: "https://github.com/sample/project/pull/5",
  });

  expect(checklist.map((item) => [item.key, item.done])).toEqual([
    ["bot-token", false],
    ["provider-key", false],
    ["skills", true],
    ["workflows", false],
    ["invitation", false],
  ]);
  expect(checklist[0]?.links.map((link) => link.url)).toEqual([
    "https://github.com/settings/tokens/new?scopes=repo&description=shadowclone+sample%2Fproject",
    "https://github.com/sample/project/settings/environments/77/edit",
  ]);
  expect(checklist[1]?.action).toBe("Add the key as ANTHROPIC_API_KEY.");
  expect(checklist[1]?.links.map((link) => link.url)).toEqual([
    "https://platform.claude.com/settings/keys",
    "https://github.com/sample/project/settings/environments/77/edit",
  ]);
  expect(checklist[4]?.action).toContain("Its check run accepts the invitation");
});

test("the checklist reads secret names only, and marks a finished setup done", async () => {
  const { call, calls } = repositoryState({
    secrets: ["SHADOWCLONE_BOT_TOKEN", "ANTHROPIC_API_KEY", "SHADOWCLONE_SKILLS_KEY"],
    merged: true,
    collaborator: true,
  });
  const checklist = await readCloudChecklist({ call, clone: fixtureClone, pullUrl: null });

  expect(checklist.every((item) => item.done)).toBeTrue();
  expect(calls.every((request) => request.method === "GET")).toBeTrue();
});

test("a provider key counts as added only under the secret name of the chosen provider", async () => {
  const { call } = repositoryState({
    secrets: ["SHADOWCLONE_BOT_TOKEN", "ANTHROPIC_API_KEY", "SHADOWCLONE_SKILLS_KEY"],
    merged: true,
    collaborator: true,
  });
  const checklist = await readCloudChecklist({
    call,
    clone: { ...fixtureClone, provider: "openai-compatible", baseUrl: "https://models.example.test/v1", model: "sample-model" },
    pullUrl: null,
  });
  const providerKey = checklist.find((item) => item.key === "provider-key");

  expect(providerKey?.done).toBeFalse();
  expect(providerKey?.action).toBe(
    "Add the key for https://models.example.test/v1 as OPENAI_COMPATIBLE_API_KEY. The endpoint must serve the OpenAI Responses API.",
  );
});
