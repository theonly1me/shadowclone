import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseCursorStream } from "./parseCursor";
import { buildEnginePrompt } from "./prompt";
import type {
  EngineRun,
  EngineRunOptions,
  PermissionMode,
} from "./types";

function validateCursorOptions(options: EngineRunOptions): void {
  if (options.sessionId !== undefined) {
    throw new Error("Cursor cannot set a caller-provided session id");
  }
  if (options.maxBudgetUsd !== undefined) {
    throw new Error("Cursor cannot enforce a per-run dollar budget");
  }
  if (options.disallowedTools && options.disallowedTools.length > 0) {
    throw new Error("Cursor cannot enforce a granular tool denylist");
  }
  if (options.allowedTools && options.allowedTools.length > 0) {
    throw new Error("Cursor cannot enforce a granular tool allowlist");
  }
  const supportedModes: readonly (PermissionMode | undefined)[] = [
    undefined,
    "dontAsk",
    "plan",
  ];
  if (!supportedModes.includes(options.permissionMode)) {
    throw new Error("Cursor cannot honor this permission mode");
  }
}

export function buildCursorArguments(
  options: EngineRunOptions,
): readonly string[] {
  validateCursorOptions(options);
  const arguments_ = [
    "cursor-agent",
    "--print",
    "--output-format",
    "stream-json",
    "--sandbox",
    "enabled",
    "--mode",
    options.permissionMode === "plan" ? "plan" : "ask",
    "--workspace",
    options.cwd,
  ];
  if (options.model) {
    arguments_.push("--model", options.model);
  }
  return arguments_;
}

async function runCursorProcess(options: {
  readonly run: EngineRunOptions;
  readonly workspace: string;
}): Promise<EngineRun> {
  const prompt = await buildEnginePrompt({
    run: options.run,
    outputSchemaInPrompt: true,
  });
  const fallbackSessionId = crypto.randomUUID();
  const process = Bun.spawn({
    cmd: [
      ...buildCursorArguments({ ...options.run, cwd: options.workspace }),
      "--trust",
    ],
    cwd: options.workspace,
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
  const run = parseCursorStream({ stream, fallbackSessionId });
  return exitCode === 0 ? run : { ...run, isError: true };
}

export async function runCursorAgent(
  options: EngineRunOptions,
): Promise<EngineRun> {
  validateCursorOptions(options);
  if (options.allowedTools?.length !== 0) {
    return runCursorProcess({ run: options, workspace: options.cwd });
  }
  const workspace = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-cursor-"),
  );
  const configDirectory = path.join(workspace, ".cursor");
  await mkdir(configDirectory, { recursive: true });
  await Bun.write(
    path.join(configDirectory, "cli.json"),
    JSON.stringify({
      version: 1,
      permissions: {
        allow: [],
        deny: [
          "Shell(*)",
          "Read(*)",
          "Write(*)",
          "WebFetch(*)",
          "Mcp(*:*)",
        ],
      },
    }),
  );
  try {
    return await runCursorProcess({ run: options, workspace });
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}
