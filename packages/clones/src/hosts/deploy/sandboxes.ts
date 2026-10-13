import { daytonaApi } from "../../receivers/daytona";
import { sandboxTemplateName } from "../../receivers/launch";
import { failure, runIn, writeProject, type DeployContext } from "./types";

export const e2bCli = ["npx", "--yes", "@e2b/cli@2.22.0"] as const;

export type SandboxPreparation =
  { readonly kind: "ready" } | { readonly kind: "manual"; readonly step: string };

async function prepareE2b(context: DeployContext): Promise<SandboxPreparation> {
  const name = sandboxTemplateName(context.config.image);

  await writeProject({
    directory: context.directory,
    files: { "e2b.Dockerfile": `FROM --platform=linux/amd64 ${context.config.image}\n` },
  });

  if ((await runIn({ context, command: [...e2bCli, "auth", "info"] })).exitCode !== 0) {
    return {
      kind: "manual",
      step: `Run ${e2bCli.join(" ")} auth login, then run setup again to build the E2B template ${name}.`,
    };
  }

  const built = await runIn({
    context,
    command: [...e2bCli, "template", "create", name, "-d", "e2b.Dockerfile"],
  });

  if (built.exitCode !== 0) {
    throw failure({ step: "e2b template create", result: built });
  }

  return { kind: "ready" };
}

async function prepareDaytona(context: DeployContext): Promise<SandboxPreparation> {
  const name = sandboxTemplateName(context.config.image);
  const key = context.environment.DAYTONA_API_KEY ?? "";
  const body = JSON.stringify({ name, imageName: context.config.image });

  if (key === "") {
    return {
      kind: "manual",
      step: `Create the Daytona snapshot ${name} from ${context.config.image} once in the Daytona dashboard, or run setup again with DAYTONA_API_KEY set.`,
    };
  }

  const response = await fetch(`${daytonaApi}/snapshots`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body,
  });

  if (!response.ok && response.status !== 409) {
    throw new Error(
      `Daytona refused the snapshot ${name} (${response.status}): ${(await response.text()).slice(0, 300)}`,
    );
  }

  return { kind: "ready" };
}

export async function prepareSandboxHost(context: DeployContext): Promise<SandboxPreparation> {
  return context.config.host === "e2b"
    ? prepareE2b(context)
    : context.config.host === "daytona"
      ? prepareDaytona(context)
      : { kind: "ready" };
}
