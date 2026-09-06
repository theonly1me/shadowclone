import { parseClaudeStream } from "./parseClaude";
import type {
  EngineRun,
  EngineRunOptions,
} from "./types";

function appendList(options: {
  readonly arguments_: string[];
  readonly flag: string;
  readonly values: readonly string[] | undefined;
}): void {
  if (options.values === undefined || options.values.length === 0) {
    return;
  }
  options.arguments_.push(options.flag);
  options.arguments_.push(...options.values);
}

export function buildClaudeArguments(options: {
  readonly run: EngineRunOptions;
  readonly sessionId: string;
}): readonly string[] {
  const arguments_ = [
    "claude",
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--session-id",
    options.sessionId,
    "--setting-sources",
    "user,project",
  ];
  if (options.run.systemPromptFile) {
    arguments_.push(
      "--append-system-prompt-file",
      options.run.systemPromptFile,
    );
  }
  if (options.run.model) {
    arguments_.push("--model", options.run.model);
  }
  if (options.run.permissionMode) {
    arguments_.push("--permission-mode", options.run.permissionMode);
  }
  if (options.run.maxBudgetUsd !== undefined) {
    arguments_.push(
      "--max-budget-usd",
      options.run.maxBudgetUsd.toString(),
    );
  }
  if (options.run.outputSchema !== undefined) {
    arguments_.push("--json-schema", JSON.stringify(options.run.outputSchema));
  }
  appendList({
    arguments_,
    flag: "--allowedTools",
    values: options.run.allowedTools,
  });
  appendList({
    arguments_,
    flag: "--disallowedTools",
    values: options.run.disallowedTools,
  });
  return arguments_;
}

export async function runClaudeCode(
  options: EngineRunOptions,
): Promise<EngineRun> {
  const sessionId = options.sessionId ?? crypto.randomUUID();
  const process = Bun.spawn({
    cmd: [...buildClaudeArguments({ run: options, sessionId })],
    cwd: options.cwd,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "ignore",
    signal: options.signal,
  });
  process.stdin.write(options.prompt);
  process.stdin.end();
  const [exitCode, stream] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
  ]);
  const run = parseClaudeStream({ stream, fallbackSessionId: sessionId });
  return exitCode === 0 ? run : { ...run, isError: true };
}
