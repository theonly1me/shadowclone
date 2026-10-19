import {
  chatgptLoginArguments,
  clonesPaths,
  dockerLauncher,
  runContainerCheckFromEnvironment,
  runContainerClone,
  serveClones,
} from "@shadowclone/clones";
import { cloneControlUsage, controlOperations } from "./cloneControl";
import {
  cloneSetupUsage,
  configuredRepository,
  secretsCommand,
  setupCommand,
  statusCommand,
} from "./cloneOptions";
import { pushSkillsInTerminal } from "./cloneSetup";

export const cloneUsage = `Clones: ${cloneSetupUsage}; clone skills [--yes]; clone login|status|secrets --repo owner/repository; ${cloneControlUsage}; serve`;

async function login(arguments_: readonly string[]): Promise<void> {
  const config = await configuredRepository(arguments_);

  if (config.provider !== "chatgpt-subscription") {
    throw new Error(`${config.repository} uses ${config.provider}, which needs no device login.`);
  }

  const child = Bun.spawn([...chatgptLoginArguments(config)], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  process.exitCode = await child.exited;
}

function stopSignal(): AbortSignal {
  const controller = new AbortController();

  process.on("SIGTERM", () => controller.abort());
  process.on("SIGINT", () => controller.abort());

  return controller.signal;
}

export async function serveCommand(): Promise<void> {
  const paths = clonesPaths();
  const outcome = await serveClones({
    paths,
    launch: dockerLauncher({ paths }),
    signal: stopSignal(),
    now: () => new Date(),
    log: (line) => console.log(`${new Date().toISOString()} ${line}`),
  });

  if (outcome === "already-running") {
    console.log("shadowclone serve already runs on this machine.");
    process.exitCode = 1;
  }
}

const operations: Readonly<Record<string, (arguments_: readonly string[]) => Promise<void>>> = {
  setup: setupCommand,
  skills: async (arguments_) => {
    await pushSkillsInTerminal({ yes: arguments_.includes("--yes") });
  },
  status: statusCommand,
  secrets: secretsCommand,
  login,
  ...controlOperations,
  run: async () => {
    const final = await runContainerClone({ environment: process.env, signal: stopSignal() });

    process.exitCode = final.state === "done" ? 0 : 1;
  },
  check: async () => {
    const lines = await runContainerCheckFromEnvironment(process.env);

    console.log(lines.map((line) => JSON.stringify(line)).join("\n"));
    process.exitCode = lines.every((line) => line.passed) ? 0 : 1;
  },
};

export async function cloneCommand(arguments_: readonly string[]): Promise<void> {
  const [operation = "", ...rest] = arguments_;
  const handler = operations[operation];

  if (handler === undefined) {
    console.log(cloneUsage);
    process.exitCode = operation === "" ? 0 : 1;
    return;
  }

  await handler(rest);
}
