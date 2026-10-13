import {
  chatgptLoginArguments,
  clonesPaths,
  dockerLauncher,
  githubThroughGh,
  latestSessionLog,
  listSessions,
  runContainerCheckFromEnvironment,
  runContainerSession,
  serveSessions,
  startSession,
} from "@shadowclone/clones";
import {
  configuredRepository,
  flagValue,
  secretsCommand,
  sessionSetupUsage,
  setupCommand,
  statusCommand,
} from "./sessionHosts";
import { pushSkillsInTerminal } from "./sessionSetup";

export const sessionUsage = `Cloud sessions: ${sessionSetupUsage}; session skills [--yes]; session login|status|secrets|list --repo owner/repository; session start --repo owner/repository --issue <number> [task]; session logs; serve`;

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

async function start(arguments_: readonly string[]): Promise<void> {
  const repository = flagValue({ arguments: arguments_, flag: "--repo" });
  const entity = Number(flagValue({ arguments: arguments_, flag: "--issue" }));
  const flags = new Set(["--repo", "--issue", repository ?? "", String(entity)]);

  if (repository === null || !Number.isSafeInteger(entity) || entity <= 0) {
    throw new Error(sessionUsage);
  }

  const task = arguments_.filter((argument) => !flags.has(argument)).join(" ");

  console.log(await startSession({ github: githubThroughGh, repository, entity, task }));
}

async function list(arguments_: readonly string[]): Promise<void> {
  const sessions = await listSessions({
    github: githubThroughGh,
    config: await configuredRepository(arguments_),
  });

  console.log(
    sessions.length === 0
      ? "No sessions in the last 100 comments."
      : sessions
          .map(
            (session) =>
              `${session.state} ${session.kind} ${session.branch} ${session.updatedAt} ${session.url}`,
          )
          .join("\n"),
  );
}

async function logs(): Promise<void> {
  const file = await latestSessionLog(clonesPaths());

  if (file === null) {
    console.log("No session has run on this machine yet.");
    return;
  }

  console.log(`${file}\n${(await Bun.file(file).text()).split("\n").slice(-200).join("\n")}`);
}

function stopSignal(): AbortSignal {
  const controller = new AbortController();

  process.on("SIGTERM", () => controller.abort());
  process.on("SIGINT", () => controller.abort());

  return controller.signal;
}

export async function serveCommand(): Promise<void> {
  const paths = clonesPaths();

  await serveSessions({
    paths,
    github: githubThroughGh,
    launch: dockerLauncher({ paths, now: () => new Date() }),
    signal: stopSignal(),
    now: () => new Date(),
    log: (line) => console.log(`${new Date().toISOString()} ${line}`),
  });
}

const operations: Readonly<Record<string, (arguments_: readonly string[]) => Promise<void>>> = {
  setup: setupCommand,
  skills: async (arguments_) => {
    await pushSkillsInTerminal({ yes: arguments_.includes("--yes") });
  },
  status: statusCommand,
  secrets: secretsCommand,
  login,
  start,
  list,
  logs,
  run: async () => {
    console.log(
      JSON.stringify(await runContainerSession({ environment: process.env, signal: stopSignal() })),
    );
  },
  check: async () => {
    const lines = await runContainerCheckFromEnvironment(process.env);

    console.log(lines.map((line) => JSON.stringify(line)).join("\n"));
    process.exitCode = lines.every((line) => line.passed) ? 0 : 1;
  },
};

export async function sessionCommand(arguments_: readonly string[]): Promise<void> {
  const [operation = "", ...rest] = arguments_;
  const handler = operations[operation];

  if (handler === undefined) {
    console.log(sessionUsage);
    process.exitCode = operation === "" ? 0 : 1;
    return;
  }

  await handler(rest);
}
