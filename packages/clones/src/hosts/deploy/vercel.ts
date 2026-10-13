import path from "node:path";
import { webhookSecretVariable } from "../../receivers/runtime";
import { deploymentName } from "../cloudflare";
import { vercel, vercelFiles, vercelImageName, vercelUrl, vercelVariables } from "../vercel";
import {
  failure,
  forwardedSecrets,
  receiverSecretSteps,
  runIn,
  writeProject,
  type DeployContext,
  type DeployOutcome,
} from "./types";

async function setVariable(options: {
  readonly context: DeployContext;
  readonly name: string;
  readonly value: string;
}): Promise<void> {
  await runIn({
    context: options.context,
    command: [...vercel, "env", "rm", options.name, "production", "--yes"],
  });

  const added = await runIn({
    context: options.context,
    command: [...vercel, "env", "add", options.name, "production"],
    input: options.value,
  });

  if (added.exitCode !== 0) {
    throw failure({ step: `vercel env add ${options.name}`, result: added });
  }
}

export async function deployVercel(context: DeployContext): Promise<DeployOutcome> {
  const { config } = context;
  const project = deploymentName(config);

  if (
    config.host === "vercel" &&
    (await runIn({ context, command: ["docker", "info", "--format", "{{.ServerVersion}}"] }))
      .exitCode !== 0
  ) {
    return {
      kind: "needs-tool",
      detail: "Start Docker. Setup pushes the clone image to the Vercel Container Registry once.",
    };
  }

  await writeProject({
    directory: context.directory,
    files: vercelFiles({ config, bundle: context.bundle }),
  });

  if ((await runIn({ context, command: [...vercel, "whoami"] })).exitCode !== 0) {
    return { kind: "needs-login", command: `${vercel.join(" ")} login` };
  }

  const linked = await runIn({
    context,
    command: [...vercel, "link", "--yes", "--project", project],
  });

  if (linked.exitCode !== 0) {
    throw failure({ step: "vercel link", result: linked });
  }

  for (const [name, value] of Object.entries({
    ...vercelVariables({ config, forward: forwardedSecrets(config) }),
    [webhookSecretVariable]: context.webhookSecret,
  })) {
    await setVariable({ context, name, value });
  }

  if (config.host === "vercel") {
    const pushed = await context.processes.run({
      arguments: [...vercel, "vcr", "build", "docker", ".", vercelImageName(config), "--push"],
      cwd: path.join(context.directory, "image"),
    });

    if (pushed.exitCode !== 0) {
      throw failure({ step: "vercel vcr build", result: pushed });
    }
  }

  const deployed = await runIn({ context, command: [...vercel, "deploy", "--prod", "--yes"] });
  const url = vercelUrl(`${deployed.stdout}\n${deployed.stderr}`);

  if (deployed.exitCode !== 0 || url === null) {
    throw failure({ step: "vercel deploy", result: deployed });
  }

  return {
    kind: "deployed",
    url: `${url}/api/webhook`,
    directory: context.directory,
    secrets: receiverSecretSteps(config),
    secretPlace: `the Vercel project ${project}`,
    afterSecrets: [`${vercel.join(" ")} deploy --prod --yes --cwd ${context.directory}`],
  };
}
