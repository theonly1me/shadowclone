import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseCodexStream } from "./parseCodex";
import { buildEnginePrompt } from "./prompt";
import type {
  EngineRun,
  EngineRunOptions,
  PermissionMode,
} from "./types";

function validateCodexOptions(options: EngineRunOptions): void {
  if (options.sessionId !== undefined) {
    throw new Error("Codex cannot set a caller-provided session id");
  }
  if (options.maxBudgetUsd !== undefined) {
    throw new Error("Codex cannot enforce a per-run dollar budget");
  }
  if (options.disallowedTools && options.disallowedTools.length > 0) {
    throw new Error("Codex cannot enforce a granular tool denylist");
  }
  if (options.allowedTools && options.allowedTools.length > 0) {
    throw new Error("Codex cannot enforce a granular tool allowlist");
  }
  const supportedModes: readonly (PermissionMode | undefined)[] = [
    undefined,
    "dontAsk",
    "plan",
  ];
  if (!supportedModes.includes(options.permissionMode)) {
    throw new Error("Codex cannot honor this permission mode");
  }
}

export function buildCodexArguments(options: {
  readonly run: EngineRunOptions;
  readonly outputSchemaPath?: string;
}): readonly string[] {
  validateCodexOptions(options.run);
  const arguments_ = [
    "codex",
    "exec",
    "-",
    "--json",
    "--sandbox",
    "read-only",
    "-C",
    options.run.cwd,
    "--skip-git-repo-check",
    "-c",
    'approval_policy="never"',
    "-c",
    "mcp_servers={}",
  ];
  if (options.run.allowedTools?.length === 0) {
    arguments_.push("--disable", "shell_tool");
  }
  if (options.run.model) {
    arguments_.push("--model", options.run.model);
  }
  if (options.outputSchemaPath) {
    arguments_.push("--output-schema", options.outputSchemaPath);
  }
  return arguments_;
}

async function runCodexProcess(options: {
  readonly run: EngineRunOptions;
  readonly outputSchemaPath?: string;
}): Promise<EngineRun> {
  const prompt = await buildEnginePrompt({
    run: options.run,
    outputSchemaInPrompt: false,
  });
  const fallbackSessionId = crypto.randomUUID();
  const startedAt = Date.now();
  const process = Bun.spawn({
    cmd: [...buildCodexArguments(options)],
    cwd: options.run.cwd,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "ignore",
    signal: options.run.signal,
  });
  process.stdin.write(prompt);
  process.stdin.end();
  const [exitCode, stream] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
  ]);
  const run = parseCodexStream({
    stream,
    fallbackSessionId,
    durationMs: Date.now() - startedAt,
  });
  return exitCode === 0 ? run : { ...run, isError: true };
}

export async function runCodex(
  options: EngineRunOptions,
): Promise<EngineRun> {
  validateCodexOptions(options);
  if (options.outputSchema === undefined) {
    return runCodexProcess({ run: options });
  }
  const directory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-codex-"));
  const outputSchemaPath = path.join(directory, "schema.json");
  await Bun.write(outputSchemaPath, JSON.stringify(options.outputSchema));
  try {
    return await runCodexProcess({ run: options, outputSchemaPath });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
