import { rm } from "node:fs/promises";
import path from "node:path";
import { configVariable, forwardVariable, webhookSecretVariable } from "../../receivers/runtime";
import { deploymentName } from "../cloudflare";
import { denoFiles, denoUrl, functionName, supabase, supabaseFiles, supabaseUrl } from "../edge";
import {
  failure,
  forwardedSecrets,
  receiverSecretSteps,
  runIn,
  writeProject,
  type DeployContext,
  type DeployOutcome,
} from "./types";

function receiverVariables(context: DeployContext): Readonly<Record<string, string>> {
  return {
    [configVariable]: JSON.stringify(context.config),
    [forwardVariable]: forwardedSecrets(context.config).join(","),
    [webhookSecretVariable]: context.webhookSecret,
  };
}

export async function deploySupabase(context: DeployContext): Promise<DeployOutcome> {
  const projectRef = context.supabaseProject;

  if (projectRef === undefined) {
    return {
      kind: "needs-tool",
      detail: "Name the Supabase project with --supabase-project <project-ref>.",
    };
  }

  await writeProject({
    directory: context.directory,
    files: supabaseFiles({ bundle: context.bundle }),
  });

  if ((await runIn({ context, command: [...supabase, "projects", "list"] })).exitCode !== 0) {
    return { kind: "needs-login", command: `${supabase.join(" ")} login` };
  }

  const environmentFile = path.join(context.directory, ".receiver.env");

  try {
    await writeProject({
      directory: context.directory,
      files: {
        ".receiver.env": Object.entries(receiverVariables(context))
          .map(([name, value]) => `${name}=${JSON.stringify(value)}`)
          .join("\n"),
      },
    });

    const secrets = await runIn({
      context,
      command: [
        ...supabase,
        "secrets",
        "set",
        "--env-file",
        environmentFile,
        "--project-ref",
        projectRef,
      ],
    });

    if (secrets.exitCode !== 0) {
      throw failure({ step: "supabase secrets set", result: secrets });
    }
  } finally {
    await rm(environmentFile, { force: true });
  }

  const deployed = await runIn({
    context,
    command: [
      ...supabase,
      "functions",
      "deploy",
      functionName,
      "--no-verify-jwt",
      "--use-api",
      "--project-ref",
      projectRef,
    ],
  });

  if (deployed.exitCode !== 0) {
    throw failure({ step: "supabase functions deploy", result: deployed });
  }

  return {
    kind: "deployed",
    url: supabaseUrl({ projectRef }),
    directory: context.directory,
    secrets: receiverSecretSteps(context.config),
    secretPlace: `the Edge Function secrets of the Supabase project ${projectRef}`,
    afterSecrets: [],
  };
}

export async function deployDeno(context: DeployContext): Promise<DeployOutcome> {
  const organization = context.denoOrganization;
  const app = deploymentName(context.config);

  if (organization === undefined) {
    return {
      kind: "needs-tool",
      detail: "Name the Deno Deploy organization with --deno-org <organization>.",
    };
  }

  await writeProject({
    directory: context.directory,
    files: denoFiles({ bundle: context.bundle }),
  });

  const target = ["--org", organization, "--app", app];

  await runIn({
    context,
    command: [
      "deno",
      "deploy",
      "create",
      ...target,
      "--source",
      "local",
      "--runtime-mode",
      "dynamic",
      "--entrypoint",
      "main.js",
      "--region",
      "us",
    ],
  });

  for (const [name, value] of Object.entries(receiverVariables(context))) {
    const added = await runIn({
      context,
      command: ["deno", "deploy", "env", "add", name, value, "--secret", ...target],
    });

    if (added.exitCode !== 0) {
      throw failure({ step: `deno deploy env add ${name}`, result: added });
    }
  }

  const deployed = await runIn({ context, command: ["deno", "deploy", "--prod", ...target] });

  if (deployed.exitCode !== 0) {
    throw failure({ step: "deno deploy", result: deployed });
  }

  return {
    kind: "deployed",
    url: denoUrl({ app, organization }),
    directory: context.directory,
    secrets: receiverSecretSteps(context.config),
    secretPlace: `the environment variables of the Deno Deploy app ${app}`,
    afterSecrets: [`deno deploy --prod --org ${organization} --app ${app}`],
  };
}
