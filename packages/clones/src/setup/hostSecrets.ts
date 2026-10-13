import { deploymentName, wrangler } from "../hosts/cloudflare";
import { receiverSecretSteps } from "../hosts/deploy/types";
import { modalNames } from "../hosts/modal";
import { vercel } from "../hosts/vercel";
import { pingReceiver } from "../hosts/webhook";
import type { GithubCall } from "../github";
import type { SessionConfig } from "../session/config";
import type { ClonesPaths } from "../session/store";
import type { CheckLine } from "./check";
import { hostDirectory } from "./cloud";

export type SecretEntry =
  | {
      readonly kind: "interactive";
      readonly directory: string;
      readonly commands: readonly (readonly string[])[];
      readonly after: readonly (readonly string[])[];
    }
  | { readonly kind: "manual"; readonly place: string; readonly names: readonly string[] };

export function secretEntry(options: {
  readonly config: SessionConfig;
  readonly paths: ClonesPaths;
}): SecretEntry {
  const { config } = options;
  const names = receiverSecretSteps(config).map((step) => step.name);
  const receiver = config.receiver ?? config.host;
  const directory = hostDirectory(options);
  const worker = deploymentName(config);

  if (receiver === "local") {
    return { kind: "manual", place: options.paths.secretsFile, names };
  }

  if (receiver === "cloudflare") {
    return {
      kind: "interactive",
      directory,
      commands: names.map((name) => [...wrangler, "secret", "put", name, "--name", worker]),
      after: [],
    };
  }

  if (receiver === "vercel") {
    return {
      kind: "interactive",
      directory,
      commands: names.map((name) => [...vercel, "env", "add", name, "production", "--sensitive"]),
      after: [[...vercel, "deploy", "--prod", "--yes"]],
    };
  }

  const places: Readonly<Record<string, string>> = {
    supabase: "the Edge Function secrets page of your Supabase project",
    deno: `the environment variables of the Deno Deploy app ${worker}`,
    modal: `a Modal secret named ${modalNames(config).runSecret}, on the Secrets page of your Modal workspace`,
  };

  return { kind: "manual", place: places[receiver] ?? receiver, names };
}

export async function checkCloudHost(options: {
  readonly config: SessionConfig;
  readonly github: GithubCall;
}): Promise<readonly CheckLine[]> {
  const url = options.config.receiverUrl;

  if (url === undefined) {
    return [
      {
        name: "Receiver",
        passed: false,
        detail: "No receiver is deployed. Run shadowclone session setup again.",
      },
    ];
  }

  const ping = await pingReceiver({
    github: options.github,
    repository: options.config.repository,
    url,
    wait: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  });

  if (ping.kind === "missing") {
    return [
      {
        name: "Webhook",
        passed: false,
        detail: `The repository has no webhook for ${url}. Run setup again.`,
      },
    ];
  }

  if (ping.kind === "pending") {
    return [
      {
        name: "Receiver",
        passed: false,
        detail: "GitHub sent a ping, and no delivery result arrived in 20 seconds.",
      },
    ];
  }

  return [
    {
      name: "Receiver",
      passed: ping.statusCode === 204,
      detail:
        ping.statusCode === 204
          ? `${url} answered the signed ping.`
          : ping.statusCode === 401
            ? "The receiver refused the signature. Run setup again to rotate the webhook secret."
            : `The receiver answered ${ping.statusCode}. Read the host's logs.`,
    },
    {
      name: "Model login",
      passed: true,
      detail:
        "The first /shadowclone comment checks the tokens in the sandbox. A login failure shows in its status comment.",
    },
  ];
}
