import { z } from "zod";
import { githubData, type GithubCall } from "../github";

export const webhookEvents = [
  "issue_comment",
  "pull_request_review_comment",
  "pull_request_review",
  "workflow_run",
];

const hooksSchema = z.array(
  z.object({ id: z.number().int().positive(), config: z.object({ url: z.string().optional() }) }),
);

const deliveriesSchema = z.array(
  z.object({ event: z.string(), status_code: z.number(), delivered_at: z.string() }),
);

export function webhookSecret(): string {
  return [...crypto.getRandomValues(new Uint8Array(32))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function findHook(options: {
  readonly github: GithubCall;
  readonly repository: string;
  readonly url: string;
}): Promise<number | null> {
  const hooks = hooksSchema.parse(
    await githubData({
      github: options.github,
      route: `repos/${options.repository}/hooks?per_page=100`,
    }),
  );

  return hooks.find((hook) => hook.config.url === options.url)?.id ?? null;
}

export async function registerWebhook(options: {
  readonly github: GithubCall;
  readonly repository: string;
  readonly url: string;
  readonly secret: string;
}): Promise<number> {
  const body = {
    name: "web",
    active: true,
    events: webhookEvents,
    config: { url: options.url, content_type: "json", secret: options.secret, insecure_ssl: "0" },
  };
  const existing = await findHook(options);

  if (existing !== null) {
    await githubData({
      github: options.github,
      method: "PATCH",
      route: `repos/${options.repository}/hooks/${existing}`,
      body,
    });
    return existing;
  }

  const created = z.object({ id: z.number().int().positive() }).parse(
    await githubData({
      github: options.github,
      method: "POST",
      route: `repos/${options.repository}/hooks`,
      body,
    }),
  );

  return created.id;
}

export type ReceiverCheck =
  | { readonly kind: "missing" }
  | { readonly kind: "delivered"; readonly statusCode: number; readonly at: string }
  | { readonly kind: "pending" };

export async function pingReceiver(options: {
  readonly github: GithubCall;
  readonly repository: string;
  readonly url: string;
  readonly wait: (milliseconds: number) => Promise<void>;
}): Promise<ReceiverCheck> {
  const hook = await findHook(options);

  if (hook === null) {
    return { kind: "missing" };
  }

  const base = `repos/${options.repository}/hooks/${hook}`;
  const startedAt = new Date().toISOString();

  await githubData({ github: options.github, method: "POST", route: `${base}/pings` });

  for (let attempt = 0; attempt < 10; attempt++) {
    await options.wait(2_000);

    const ping = deliveriesSchema
      .parse(await githubData({ github: options.github, route: `${base}/deliveries?per_page=10` }))
      .find(
        (delivery) => delivery.event === "ping" && delivery.delivered_at >= startedAt.slice(0, 19),
      );

    if (ping !== undefined) {
      return { kind: "delivered", statusCode: ping.status_code, at: ping.delivered_at };
    }
  }

  return { kind: "pending" };
}
