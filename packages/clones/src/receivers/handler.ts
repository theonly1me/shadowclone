import { parseSessionCommand } from "../trigger/command";
import type { CommentSource, SessionEvent } from "../trigger/event";
import { validSignature } from "./signature";

export type ReceiverSettings = {
  readonly webhookSecret: string;
  readonly ownerId: number;
  readonly repositoryId: number;
  readonly reviewerBots: readonly string[];
};

export type StartSession = (event: SessionEvent) => Promise<void>;

type Payload = Record<string, unknown>;

function record(value: unknown): Payload {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {};
}

function positive(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

const commentEvents: Readonly<
  Record<
    string,
    {
      readonly source: CommentSource;
      readonly item: string;
      readonly entity: string;
      readonly actions: readonly string[];
    }
  >
> = {
  issue_comment: {
    source: "issue_comment",
    item: "comment",
    entity: "issue",
    actions: ["created", "edited"],
  },
  pull_request_review_comment: {
    source: "pull_request_review_comment",
    item: "comment",
    entity: "pull_request",
    actions: ["created", "edited"],
  },
  pull_request_review: {
    source: "pull_request_review",
    item: "review",
    entity: "pull_request",
    actions: ["submitted", "edited"],
  },
};

function allowedSender(options: {
  readonly settings: ReceiverSettings;
  readonly sender: Payload;
  readonly body: string;
}): boolean {
  const { settings, sender } = options;
  const owner =
    sender.id === settings.ownerId &&
    sender.type === "User" &&
    parseSessionCommand(options.body) !== null;
  const reviewerBot = sender.type === "Bot" && settings.reviewerBots.includes(text(sender.login));

  return owner || reviewerBot;
}

export function sessionEventFromWebhook(options: {
  readonly name: string;
  readonly payload: Payload;
  readonly settings: ReceiverSettings;
}): SessionEvent | null {
  const { name, payload, settings } = options;
  const action = text(payload.action);

  if (record(payload.repository).id !== settings.repositoryId) {
    return null;
  }

  if (name === "workflow_run") {
    const run = record(payload.workflow_run);
    const runId = positive(run.id);

    return action === "completed" && runId !== null && record(run.actor).id === settings.ownerId
      ? { kind: "ci", runId }
      : null;
  }

  const shape = commentEvents[name];

  if (shape === undefined || !shape.actions.includes(action)) {
    return null;
  }

  const item = record(payload[shape.item]);
  const id = positive(item.id);
  const entity = positive(record(payload[shape.entity]).number);

  if (
    id === null ||
    entity === null ||
    !allowedSender({ settings, sender: record(payload.sender), body: text(item.body) })
  ) {
    return null;
  }

  return { kind: "comment", source: shape.source, id, entity };
}

export async function receiveWebhook(options: {
  readonly request: Request;
  readonly settings: ReceiverSettings;
  readonly start: StartSession;
}): Promise<{ readonly response: Response; readonly started: Promise<void> | null }> {
  if (options.request.method !== "POST") {
    return { response: new Response("Use POST.", { status: 405 }), started: null };
  }

  const body = await options.request.text();
  const signed = await validSignature({
    secret: options.settings.webhookSecret,
    body,
    header: options.request.headers.get("x-hub-signature-256"),
  });

  if (!signed) {
    return {
      response: new Response("The signature does not match.", { status: 401 }),
      started: null,
    };
  }

  const name = options.request.headers.get("x-github-event") ?? "";
  const event =
    name === "ping"
      ? null
      : sessionEventFromWebhook({
          name,
          payload: record(JSON.parse(body)),
          settings: options.settings,
        });

  if (event === null) {
    return { response: new Response(null, { status: 204 }), started: null };
  }

  return { response: new Response("Accepted.", { status: 202 }), started: options.start(event) };
}
