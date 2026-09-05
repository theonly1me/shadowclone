import type {
  EngineAvailability,
  EngineId,
  EngineRunner,
} from "./types";
import { runClaudeCode } from "./claudeCode";
import { runCodex } from "./codex";
import { runCursorAgent } from "./cursorAgent";

export type CommandProbe = (
  command: readonly string[],
) => Promise<boolean>;

export async function probeCommand(
  command: readonly string[],
): Promise<boolean> {
  try {
    const process = Bun.spawn({
      cmd: [...command],
      stdout: "ignore",
      stderr: "ignore",
    });
    return (await process.exited) === 0;
  } catch {
    return false;
  }
}

export async function detectClaudeCode(options: {
  readonly probe?: CommandProbe;
} = {}): Promise<EngineAvailability> {
  const probe = options.probe ?? probeCommand;
  const installed = await probe(["claude", "--version"]);
  const authenticated =
    installed && (await probe(["claude", "auth", "status"]));
  return { engine: "claude-code", installed, authenticated };
}

export async function detectCodex(options: {
  readonly probe?: CommandProbe;
} = {}): Promise<EngineAvailability> {
  const probe = options.probe ?? probeCommand;
  const installed = await probe(["codex", "--version"]);
  const authenticated =
    installed && (await probe(["codex", "login", "status"]));
  return { engine: "codex", installed, authenticated };
}

export async function detectCursorAgent(options: {
  readonly probe?: CommandProbe;
} = {}): Promise<EngineAvailability> {
  const probe = options.probe ?? probeCommand;
  const installed = await probe(["cursor-agent", "--version"]);
  const authenticated =
    installed && (await probe(["cursor-agent", "status"]));
  return { engine: "cursor-agent", installed, authenticated };
}

export async function detectEngine(options: {
  readonly probe?: CommandProbe;
  readonly allowedEngines?: readonly EngineId[];
} = {}): Promise<{
  readonly availability: readonly EngineAvailability[];
  readonly runner: EngineRunner | null;
  readonly selectedEngine: EngineId | null;
}> {
  const claudeCode = await detectClaudeCode(options);
  const codex = await detectCodex(options);
  const cursorAgent = await detectCursorAgent(options);
  const allowed = options.allowedEngines ?? [
    "claude-code",
    "codex",
    "cursor-agent",
  ];
  const claudeSelected =
    claudeCode.authenticated && allowed.includes("claude-code");
  const codexSelected = codex.authenticated && allowed.includes("codex");
  const cursorSelected =
    cursorAgent.authenticated && allowed.includes("cursor-agent");
  return {
    availability: [claudeCode, codex, cursorAgent],
    runner: claudeSelected
      ? runClaudeCode
      : codexSelected
        ? runCodex
        : cursorSelected
          ? runCursorAgent
          : null,
    selectedEngine: claudeSelected
      ? "claude-code"
      : codexSelected
        ? "codex"
        : cursorSelected
          ? "cursor-agent"
          : null,
  };
}
