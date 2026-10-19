import {
  handleLiveHook,
  livePaths,
  liveListLine,
  liveSessionsEnabled,
  machineLive,
  readGitFacts,
  switchLiveSessions,
  terminalTyper,
  type LiveEngine,
} from "@shadowclone/live";

export const liveUsage =
  "Live sessions: live enable|disable|status|list; live hook claude|codex (run by the agent hooks)";

function engineOf(value: string | undefined): LiveEngine | null {
  return value === "claude" || value === "codex" ? value : null;
}

async function hook(arguments_: readonly string[]): Promise<void> {
  const engine = engineOf(arguments_[0]);

  if (engine === null || !(await liveSessionsEnabled().catch(() => false))) {
    return;
  }

  const output = await handleLiveHook({
    context: {
      paths: livePaths(),
      engine,
      now: new Date(),
      environment: process.env,
      gitFacts: readGitFacts,
      typeText: terminalTyper(),
    },
    input: await Bun.stdin.text(),
  }).catch(() => null);

  if (output !== null) {
    console.log(JSON.stringify(output));
  }
}

async function switchTo(enabled: boolean): Promise<void> {
  const { changed, skipped } = await switchLiveSessions({ paths: livePaths(), enabled });

  console.log(
    [
      enabled
        ? "Live sessions are on. The hub lists your Claude Code and Codex sessions with their last message, and can send them your messages."
        : "Live sessions are off. shadowclone removed its hooks and the saved session state.",
      ...changed.map((file) => `Changed ${file}.`),
      ...skipped.map((file) => `Skipped ${file}, because the agent is not installed.`),
      ...(enabled && changed.some((file) => file.includes(".codex"))
        ? ["Codex asks you to review and trust the new hooks when it starts."]
        : []),
      ...(enabled ? ["Start a new agent session so that the hooks load."] : []),
    ].join("\n"),
  );
}

const operations: Readonly<Record<string, (arguments_: readonly string[]) => Promise<void>>> = {
  enable: () => switchTo(true),
  disable: () => switchTo(false),
  status: async () => {
    console.log(`Live sessions: ${(await liveSessionsEnabled()) ? "on" : "off"}`);
  },
  list: async () => {
    const records = await machineLive().list();

    console.log(records.length === 0 ? "No live sessions." : records.map(liveListLine).join("\n"));
  },
  hook,
};

export async function liveCommand(arguments_: readonly string[]): Promise<void> {
  const [operation = "", ...rest] = arguments_;
  const handler = operations[operation];

  if (handler === undefined) {
    console.log(liveUsage);
    process.exitCode = operation === "" ? 0 : 1;
    return;
  }

  await handler(rest);
}
