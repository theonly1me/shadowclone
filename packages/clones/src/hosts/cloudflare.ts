import type { SessionConfig } from "../session/config";
import { forwardVariable, configVariable } from "../receivers/runtime";

export const wrangler = ["npx", "--yes", "wrangler@4.150.0"] as const;

export function deploymentName(config: Pick<SessionConfig, "repository">): string {
  return `shadowclone-${config.repository.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
    .slice(0, 63)
    .replace(/-+$/, "");
}

const workerSource = `import { DurableObject } from "cloudflare:workers";
import { launchers, receiveWebhook, receiverRuntime } from "./shadowclone-receiver.js";

const inactivityMilliseconds = 4 * 60 * 60 * 1000;

export class SessionRunner extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    const container = ctx.container;

    if (container && container.running) {
      ctx.blockConcurrencyWhile(() => container.setInactivityTimeout(inactivityMilliseconds));
    }
  }

  async run(environment) {
    const container = this.ctx.container;

    if (container.running) {
      return false;
    }

    container.start({ entrypoint: ["shadowclone", "session", "run"], env: environment, enableInternet: true });
    await container.setInactivityTimeout(inactivityMilliseconds);
    return true;
  }
}

export default {
  async fetch(request, env, ctx) {
    const runtime = receiverRuntime(env);
    const { response, started } = await receiveWebhook({
      request,
      settings: runtime.settings,
      start: async (event) => {
        const environment = runtime.sandboxEnvironment(event);

        if (runtime.host !== "cloudflare") {
          await launchers[runtime.host]({ image: runtime.image, environment, secrets: env, fetch: (input, init) => fetch(input, init) });
          return;
        }

        const name = event.kind === "comment" ? "entity-" + event.entity : "run-" + event.runId;
        const runner = env.SESSION_RUNNER.get(env.SESSION_RUNNER.idFromName(name));

        await runner.run(environment);
      },
    });

    if (started) {
      ctx.waitUntil(started);
    }

    return response;
  },
};
`;

export function cloudflareFiles(options: {
  readonly config: SessionConfig;
  readonly bundle: string;
  readonly forward: readonly string[];
}): Readonly<Record<string, string>> {
  const { config } = options;
  const container = config.host === "cloudflare";
  const wranglerConfig = {
    name: deploymentName(config),
    main: "src/index.js",
    compatibility_date: "2026-10-01",
    vars: {
      [configVariable]: JSON.stringify(config),
      [forwardVariable]: options.forward.join(","),
    },
    ...(container
      ? {
          containers: [
            {
              class_name: "SessionRunner",
              image: "./Dockerfile",
              instance_type: "standard-3",
              max_instances: 5,
            },
          ],
          durable_objects: { bindings: [{ name: "SESSION_RUNNER", class_name: "SessionRunner" }] },
          migrations: [{ tag: "v1", new_sqlite_classes: ["SessionRunner"] }],
        }
      : {}),
  };

  return {
    "wrangler.jsonc": `${JSON.stringify(wranglerConfig, null, 2)}\n`,
    "src/index.js": workerSource,
    "src/shadowclone-receiver.js": options.bundle,
    ...(container ? { Dockerfile: `FROM ${config.image}\n` } : {}),
  };
}

export function workerUrl(deployOutput: string): string | null {
  return /https:\/\/[a-z0-9.-]+\.workers\.dev/.exec(deployOutput)?.[0] ?? null;
}
