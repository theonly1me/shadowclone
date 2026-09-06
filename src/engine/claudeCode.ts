import { evaluationCommand } from "./evaluationIsolation";
import { claudeEvaluationArguments } from "./evaluationArguments";
import { redactSecrets } from "../redact";
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
    options.run.evaluation ? "" : "user,project",
  ];

  arguments_.push(...claudeEvaluationArguments(options.run));

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

export function redactedFailure(options: {
  readonly run: EngineRun;
  readonly stderr: string;
  readonly exitCode: number;
}): string {
  const stderrText = options.stderr.trim();
  if (stderrText.length > 0) {
    return redactSecrets({ text: stderrText });
  }

  if (options.run.errorMessage) {
    return redactSecrets({ text: options.run.errorMessage });
  }

  const resultText = options.run.text.trim();
  return resultText.length > 0
    ? redactSecrets({ text: resultText })
    : `Process exited with code ${options.exitCode}`;
}

export async function runClaudeCode(
  options: EngineRunOptions,
): Promise<EngineRun> {
  const sessionId = options.sessionId ?? crypto.randomUUID();

  const child = Bun.spawn({
    cmd: [...evaluationCommand({ arguments: buildClaudeArguments({ run: options, sessionId }), run: options })],
    cwd: options.cwd,
    env: process.env,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    signal: options.signal,
  });

  child.stdin.write(options.prompt);
  child.stdin.end();

  const [exitCode, stream, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);

  const run = parseClaudeStream({ stream, fallbackSessionId: sessionId });

  if (exitCode !== 0) {
    return {
      ...run,
      isError: true,
      errorMessage: redactedFailure({ run, stderr, exitCode }),
    };
  }

  if (run.errorMessage) {
    return { ...run, errorMessage: redactSecrets({ text: run.errorMessage }) };
  }

  return run;
}
