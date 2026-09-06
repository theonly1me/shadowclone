import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { redactSecrets } from "../redact";
import { evaluationCommand } from "./evaluationIsolation";
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
    options.run.evaluation && options.run.allowedTools?.length !== 0
      ? "workspace-write"
      : "read-only",
    "-C",
    options.run.cwd,
    "--skip-git-repo-check",
    "-c",
    'approval_policy="never"',
    "-c",
    "mcp_servers={}",
  ];

  if (options.run.evaluation) {
    arguments_.push(
      "--ephemeral",
      "--ignore-user-config",
      "-c",
      "features.memories=false",
      "-c",
      "features.hooks=false",
      "-c",
      "features.skip_host_skill_discovery=true",
      "-c",
      "project_doc_max_bytes=0",
      "-c",
      "features.apps=false",
      "-c",
      "features.plugins=false",
      "-c",
      "features.browser_use=false",
      "-c",
      "features.computer_use=false",
      "-c",
      "features.image_generation=false",
      "-c",
      "features.view_image=false",
      "-c",
      "features.multi_agent_v2=false",
      "-c",
      'web_search="disabled"',
      "-c",
      "sandbox_workspace_write.network_access=false",
    );
  }

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
    cmd: [
      ...evaluationCommand({
        arguments: buildCodexArguments(options),
        run: options.run,
      }),
    ],
    cwd: options.run.cwd,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    signal: options.run.signal,
  });

  process.stdin.write(prompt);
  process.stdin.end();

  const [exitCode, stream, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);

  const run = parseCodexStream({
    stream,
    fallbackSessionId,
    durationMs: Date.now() - startedAt,
  });

  if (exitCode !== 0) {
    return {
      ...run,
      isError: true,
      errorMessage: redactSecrets({
        text:
          stderr.trim() ||
          run.errorMessage ||
          `Codex exited with code ${exitCode}`,
      }),
    };
  }

  return run;
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
