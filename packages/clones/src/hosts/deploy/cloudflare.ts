import { webhookSecretVariable } from "../../receivers/runtime";
import { cloudflareFiles, deploymentName, workerUrl, wrangler } from "../cloudflare";
import {
  failure,
  forwardedSecrets,
  receiverSecretSteps,
  runIn,
  writeProject,
  type DeployContext,
  type DeployOutcome,
} from "./types";

export async function deployCloudflare(context: DeployContext): Promise<DeployOutcome> {
  const { config } = context;
  const name = deploymentName(config);

  if (
    config.host === "cloudflare" &&
    (await runIn({ context, command: ["docker", "info", "--format", "{{.ServerVersion}}"] }))
      .exitCode !== 0
  ) {
    return {
      kind: "needs-tool",
      detail:
        "Start Docker. Wrangler builds the container image from the clone image during deploy.",
    };
  }

  await writeProject({
    directory: context.directory,
    files: cloudflareFiles({ config, bundle: context.bundle, forward: forwardedSecrets(config) }),
  });

  const whoami = await runIn({ context, command: [...wrangler, "whoami"] });

  if (whoami.exitCode !== 0 || /not authenticated/i.test(whoami.stdout)) {
    return { kind: "needs-login", command: `${wrangler.join(" ")} login` };
  }

  const deployed = await runIn({ context, command: [...wrangler, "deploy"] });
  const url = workerUrl(deployed.stdout);

  if (deployed.exitCode !== 0 || url === null) {
    throw failure({ step: "wrangler deploy", result: deployed });
  }

  const secret = await runIn({
    context,
    command: [...wrangler, "secret", "put", webhookSecretVariable, "--name", name],
    input: context.webhookSecret,
  });

  if (secret.exitCode !== 0) {
    throw failure({ step: "wrangler secret put", result: secret });
  }

  return {
    kind: "deployed",
    url,
    directory: context.directory,
    secrets: receiverSecretSteps(config),
    secretPlace: `the Cloudflare Worker ${name}`,
    afterSecrets: [],
  };
}

export function cloudflareSecretCommand(options: {
  readonly name: string;
  readonly worker: string;
}): readonly string[] {
  return [...wrangler, "secret", "put", options.name, "--name", options.worker];
}
