import type { SessionConfig } from "../session/config";
import { configVariable, forwardVariable } from "../receivers/runtime";

export const vercel = ["npx", "--yes", "vercel@64.0.1"] as const;

export const vercelImageVariable = "SHADOWCLONE_VERCEL_IMAGE";

export function vercelImageName(config: Pick<SessionConfig, "image">): string {
  return `shadowclone-clone:${config.image.split(":").at(-1) ?? "latest"}`;
}

const functionSource = `import { waitUntil } from "@vercel/functions";
import { Sandbox } from "@vercel/sandbox";
import { launchers, receiveWebhook, receiverRuntime } from "../shadowclone-receiver.js";

const sandboxMilliseconds = 3.25 * 60 * 60 * 1000;

export async function POST(request) {
  const runtime = receiverRuntime(process.env);
  const { response, started } = await receiveWebhook({
    request,
    settings: runtime.settings,
    start: async (event) => {
      const environment = runtime.sandboxEnvironment(event);

      if (runtime.host !== "vercel") {
        await launchers[runtime.host]({ image: runtime.image, environment, secrets: process.env, fetch: (input, init) => fetch(input, init) });
        return;
      }

      const sandbox = await Sandbox.create({
        image: process.env.${vercelImageVariable},
        resources: { vcpus: 2 },
        timeout: sandboxMilliseconds,
        persistent: false,
      });

      await sandbox.runCommand({ cmd: "shadowclone", args: ["session", "run"], env: environment, detached: true });
    },
  });

  if (started) {
    waitUntil(started);
  }

  return response;
}
`;

export function vercelFiles(options: {
  readonly config: SessionConfig;
  readonly bundle: string;
}): Readonly<Record<string, string>> {
  return {
    "package.json": `${JSON.stringify(
      {
        name: "shadowclone-receiver",
        private: true,
        type: "module",
        dependencies: { "@vercel/functions": "3.10.0", "@vercel/sandbox": "3.7.0" },
      },
      null,
      2,
    )}\n`,
    "api/webhook.js": functionSource,
    "shadowclone-receiver.js": options.bundle,
    ...(options.config.host === "vercel"
      ? { "image/Dockerfile": `FROM --platform=linux/amd64 ${options.config.image}\n` }
      : {}),
  };
}

export function vercelVariables(options: {
  readonly config: SessionConfig;
  readonly forward: readonly string[];
}): Readonly<Record<string, string>> {
  return {
    [configVariable]: JSON.stringify(options.config),
    [forwardVariable]: options.forward.join(","),
    ...(options.config.host === "vercel"
      ? { [vercelImageVariable]: vercelImageName(options.config) }
      : {}),
  };
}

export function vercelUrl(deployOutput: string): string | null {
  const urls = [...deployOutput.matchAll(/https:\/\/[a-z0-9.-]+\.vercel\.app/g)].map(
    (match) => match[0],
  );

  return urls.find((url) => !/-[a-z0-9]{9}-/.test(url)) ?? urls.at(-1) ?? null;
}
