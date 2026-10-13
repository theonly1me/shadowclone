import { afterAll, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { sampleConfig } from "../fixtures";
import { signBody } from "../receivers/signature";
import { receiverBundle } from "./bundle";

const directories: string[] = [];

afterAll(async () => {
  await Promise.all(
    directories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test("the shipped receiver bundle runs on its own and starts a sandbox for the owner's command", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-bundle-"));
  const file = path.join(directory, "shadowclone-receiver.mjs");

  directories.push(directory);
  await writeFile(file, receiverBundle());

  const bundle: unknown = await import(file);

  if (
    typeof bundle !== "object" ||
    bundle === null ||
    !("receiveWebhook" in bundle) ||
    !("receiverRuntime" in bundle) ||
    !("launchers" in bundle)
  ) {
    throw new Error("The bundle does not export the receiver functions.");
  }

  const { receiveWebhook, receiverRuntime, launchers } = bundle;

  if (
    typeof receiveWebhook !== "function" ||
    typeof receiverRuntime !== "function" ||
    typeof launchers !== "object" ||
    launchers === null
  ) {
    throw new Error("The bundle exports are not functions.");
  }

  const runtime = receiverRuntime({
    SHADOWCLONE_SESSION_CONFIG: JSON.stringify(
      sampleConfig({ host: "e2b", receiver: "cloudflare" }),
    ),
    SHADOWCLONE_WEBHOOK_SECRET: "synthetic-webhook-secret",
  });
  const body = JSON.stringify({
    action: "created",
    repository: { id: 7 },
    sender: { id: 11, login: "sample", type: "User" },
    issue: { number: 12 },
    comment: { id: 501, body: "/shadowclone fix it" },
  });
  const started: unknown[] = [];
  const result = await receiveWebhook({
    request: new Request("https://receiver.example.com/", {
      method: "POST",
      body,
      headers: {
        "x-github-event": "issue_comment",
        "x-hub-signature-256": await signBody({ secret: "synthetic-webhook-secret", body }),
      },
    }),
    settings: runtime.settings,
    start: async (event: unknown) => {
      started.push(event);
    },
  });

  await result.started;

  expect(result.response.status).toBe(202);
  expect(started).toEqual([{ kind: "comment", source: "issue_comment", id: 501, entity: 12 }]);
  expect(Object.keys(launchers).sort()).toEqual(["daytona", "e2b"]);
});
