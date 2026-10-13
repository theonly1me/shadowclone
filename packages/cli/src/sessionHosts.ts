import {
  checkCloudHost,
  checkSessionHost,
  clonesPaths,
  githubThroughGh,
  hostProcesses,
  readSessionConfig,
  secretEntry,
  sessionHosts,
  sessionProviders,
  sessionReceivers,
} from "@shadowclone/clones";
import { setUpSessionsInTerminal } from "./sessionSetup";

export const sessionSetupUsage =
  "session setup [--repo owner/repository] [--host local|cloudflare|vercel|modal|daytona|e2b] [--receiver cloudflare|vercel|supabase|deno] [--provider claude-subscription|anthropic|chatgpt-subscription|openai|openai-compatible|ollama|foundry] [--base-url url] [--model id] [--image name] [--supabase-project ref] [--deno-org name] [--no-attribution] [--yes]";

export function flagValue(options: {
  readonly arguments: readonly string[];
  readonly flag: string;
}): string | null {
  const index = options.arguments.indexOf(options.flag);

  return index < 0 ? null : (options.arguments[index + 1] ?? "");
}

export async function configuredRepository(arguments_: readonly string[]) {
  const repository = flagValue({ arguments: arguments_, flag: "--repo" });
  const config =
    repository === null ? null : await readSessionConfig({ paths: clonesPaths(), repository });

  if (config === null) {
    throw new Error(
      "Name a repository that has cloud sessions on this machine with --repo owner/repository.",
    );
  }

  return config;
}

export async function setupCommand(arguments_: readonly string[]): Promise<void> {
  const value = (flag: string) => flagValue({ arguments: arguments_, flag });
  const provider = sessionProviders.find(
    (entry) => entry === (value("--provider") ?? "claude-subscription"),
  );
  const host = sessionHosts.find((entry) => entry === (value("--host") ?? "local"));
  const receiverName = value("--receiver");
  const receiver = sessionReceivers.find((entry) => entry === receiverName);
  const baseUrl = value("--base-url");
  const model = value("--model");
  const image = value("--image");
  const supabaseProject = value("--supabase-project");
  const denoOrganization = value("--deno-org");

  if (
    provider === undefined ||
    host === undefined ||
    (receiverName !== null && receiver === undefined)
  ) {
    throw new Error(`Use shadowclone ${sessionSetupUsage}.`);
  }

  await setUpSessionsInTerminal({
    repository: value("--repo"),
    provider,
    host,
    ...(receiver === undefined ? {} : { receiver }),
    ...(baseUrl === null ? {} : { baseUrl }),
    ...(model === null ? {} : { model }),
    ...(image === null ? {} : { image }),
    ...(supabaseProject === null ? {} : { supabaseProject }),
    ...(denoOrganization === null ? {} : { denoOrganization }),
    attribution: !arguments_.includes("--no-attribution"),
    yes: arguments_.includes("--yes"),
  });
}

export async function statusCommand(arguments_: readonly string[]): Promise<void> {
  const config = await configuredRepository(arguments_);
  const lines =
    config.host === "local"
      ? await checkSessionHost({ config, paths: clonesPaths(), processes: hostProcesses })
      : await checkCloudHost({ config, github: githubThroughGh });

  for (const line of lines) {
    console.log(`${line.passed ? "pass" : "fail"} ${line.name}: ${line.detail}`);
  }

  process.exitCode = lines.every((line) => line.passed) ? 0 : 1;
}

export async function secretsCommand(arguments_: readonly string[]): Promise<void> {
  const entry = secretEntry({
    config: await configuredRepository(arguments_),
    paths: clonesPaths(),
  });

  if (entry.kind === "manual") {
    console.log(`Add ${entry.names.join(", ")} to ${entry.place}.`);
    return;
  }

  for (const command of [...entry.commands, ...entry.after]) {
    console.log(`$ ${command.join(" ")}`);

    const child = Bun.spawn([...command], {
      cwd: entry.directory,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });

    if ((await child.exited) !== 0) {
      process.exitCode = 1;
      return;
    }
  }
}
