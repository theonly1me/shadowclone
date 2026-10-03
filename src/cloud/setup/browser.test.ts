import { expect, test } from "bun:test";
import { createBotBrowser } from "./browser";
import { guidanceFixture } from "../fixtures";
import { setupRepository, syntheticApp } from "./fixtures";
import { setupPreviewSchema, manifestViewSchema } from "../browserProtocol";
import { createBrowserHandler } from "../../web/handler";

const origin = "http://127.0.0.1:12345";

function setupRequest(options: { readonly path: string; readonly body?: unknown }) {
  return new Request(`${origin}${options.path}`, {
    method: options.body === undefined ? "GET" : "POST",
    headers: {
      Origin: origin,
      Authorization: "Bearer synthetic-session",
      "Content-Type": "application/json",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

test("browser setup previews exact scoped guidance and registers the reviewed App name", async () => {
  const fixture = await guidanceFixture();
  const app = syntheticApp();
  const bot = createBotBrowser({
    ...fixture,
    origin: () => origin,
    command: async ({ arguments: arguments_ }) =>
      JSON.stringify(arguments_[1] === "user" ? { login: "sample" } : setupRepository),
    api: async () => app,
  });

  try {
    const response = await bot(
      setupRequest({
        path: "/api/bot/preview",
        body: { repository: "sample/project", name: "sample-clone", skills: ["shadowclone-work"] },
      }),
    );
    const preview = setupPreviewSchema.parse(await response.json());

    expect(preview.repositoryId).toBe(10);
    expect(preview.files.some((file) => file.path === "native.md")).toBeTrue();
    expect(JSON.stringify(preview)).not.toContain(fixture.root);

    const view = manifestViewSchema.parse(
      await (
        await bot(setupRequest({ path: "/api/bot/manifest", body: { previewId: preview.id } }))
      ).json(),
    );
    const manifest: unknown = JSON.parse(view.manifest);

    expect(manifest).toMatchObject({ name: "sample-clone", public: false });
    expect(view.action).toStartWith("https://github.com/settings/apps/new?state=");
  } finally {
    await fixture.cleanup();
  }
});

test("the editor rejects unauthenticated setup writes and a stale preview", async () => {
  const fixture = await guidanceFixture();
  let calls = 0;
  const botHandler = createBotBrowser({
    ...fixture,
    origin: () => origin,
    command: async () => {
      calls += 1;
      return "{}";
    },
  });
  const handler = createBrowserHandler({
    ...fixture,
    token: "synthetic-session",
    origin: () => origin,
    botHandler,
  });

  try {
    const missing = setupRequest({ path: "/api/bot/preview", body: {} });

    missing.headers.delete("Authorization");
    expect((await handler(missing)).status).toBe(403);
    expect(calls).toBe(0);

    const token = `sk-ant-oat01-${"synthetic".repeat(10)}`;
    const stale = await handler(
      setupRequest({ path: "/api/bot/activate", body: { previewId: crypto.randomUUID(), token } }),
    );

    expect(stale.status).toBe(400);
    expect(await stale.text()).not.toContain(token);
    expect(calls).toBe(0);
  } finally {
    await fixture.cleanup();
  }
});

test("an organization repository registers its private App under that organization", async () => {
  const fixture = await guidanceFixture();
  const bot = createBotBrowser({
    ...fixture,
    readRemote: async () => "https://github.com/sample-org/project.git",
    origin: () => origin,
    command: async ({ arguments: arguments_ }) =>
      JSON.stringify(
        arguments_[1] === "user"
          ? { login: "sample" }
          : {
              ...setupRepository,
              full_name: "sample-org/project",
              owner: { login: "sample-org", type: "Organization" },
            },
      ),
  });

  try {
    const preview = setupPreviewSchema.parse(
      await (
        await bot(
          setupRequest({
            path: "/api/bot/preview",
            body: {
              repository: "sample-org/project",
              name: "sample-clone",
              skills: ["shadowclone-work"],
            },
          }),
        )
      ).json(),
    );
    const view = manifestViewSchema.parse(
      await (
        await bot(
          setupRequest({
            path: "/api/bot/manifest",
            body: { previewId: preview.id },
          }),
        )
      ).json(),
    );

    expect(preview.appOwner).toBe("sample-org");
    expect(preview.owner).toBe("sample");
    expect(view.action).toStartWith(
      "https://github.com/organizations/sample-org/settings/apps/new?state=",
    );
  } finally {
    await fixture.cleanup();
  }
});
