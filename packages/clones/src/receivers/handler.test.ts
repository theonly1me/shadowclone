import { describe, expect, test } from "bun:test";
import type { SessionEvent } from "../trigger/event";
import { receiveWebhook, type ReceiverSettings } from "./handler";
import { signBody } from "./signature";

const settings: ReceiverSettings = {
  webhookSecret: "synthetic-webhook-secret",
  ownerId: 11,
  repositoryId: 7,
  reviewerBots: ["coderabbitai[bot]"],
};

const ownerComment = {
  action: "created",
  repository: { id: 7 },
  sender: { id: 11, login: "sample", type: "User" },
  issue: { number: 12 },
  comment: { id: 501, body: "/shadowclone fix the parser" },
};

async function deliver(options: {
  readonly name: string;
  readonly payload: unknown;
  readonly signature?: string;
}) {
  const body = JSON.stringify(options.payload);
  const started: SessionEvent[] = [];
  const request = new Request("https://receiver.example.com/", {
    method: "POST",
    body,
    headers: {
      "x-github-event": options.name,
      "x-hub-signature-256":
        options.signature ?? (await signBody({ secret: settings.webhookSecret, body })),
    },
  });
  const result = await receiveWebhook({
    request,
    settings,
    start: async (event) => {
      started.push(event);
    },
  });

  await result.started;

  return { status: result.response.status, started };
}

describe("the webhook receiver", () => {
  test("signs bodies the way GitHub documents", async () => {
    expect(await signBody({ secret: "It's a Secret to Everybody", body: "Hello, World!" })).toBe(
      "sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17",
    );
  });

  test("the owner's /shadowclone comment starts one session and answers 202", async () => {
    expect(await deliver({ name: "issue_comment", payload: ownerComment })).toEqual({
      status: 202,
      started: [{ kind: "comment", source: "issue_comment", id: 501, entity: 12 }],
    });
  });

  test("a delivery with a wrong signature starts nothing", async () => {
    const result = await deliver({
      name: "issue_comment",
      payload: ownerComment,
      signature: "sha256=00",
    });

    expect(result).toEqual({ status: 401, started: [] });
  });

  test("a collaborator's command and an event from another repository start nothing", async () => {
    const collaborator = { ...ownerComment, sender: { id: 12, login: "sample", type: "User" } };
    const otherRepository = { ...ownerComment, repository: { id: 8 } };

    expect(await deliver({ name: "issue_comment", payload: collaborator })).toEqual({
      status: 204,
      started: [],
    });
    expect(await deliver({ name: "issue_comment", payload: otherRepository })).toEqual({
      status: 204,
      started: [],
    });
  });

  test("a finished CI run on the owner's push and a reviewer bot review start the continuation checks", async () => {
    const run = {
      action: "completed",
      repository: { id: 7 },
      workflow_run: { id: 900, actor: { id: 11 } },
    };
    const review = {
      action: "submitted",
      repository: { id: 7 },
      sender: { id: 13, login: "coderabbitai[bot]", type: "Bot" },
      pull_request: { number: 40 },
      review: { id: 77, body: "Two findings." },
    };

    expect((await deliver({ name: "workflow_run", payload: run })).started).toEqual([
      { kind: "ci", runId: 900 },
    ]);
    expect((await deliver({ name: "pull_request_review", payload: review })).started).toEqual([
      { kind: "comment", source: "pull_request_review", id: 77, entity: 40 },
    ]);
  });
});
