import type {
  EngineAvailability,
  EngineId,
  EngineRunner,
} from "./types";
import {
  getProviderByEngine,
  providerSupportsPurpose,
  type EnginePurpose,
} from "../provider";
import { runClaudeCode } from "./claudeCode";
import { runCodex } from "./codex";
import { runCursorAgent } from "./cursorAgent";

export type CommandProbe = (options: {
  readonly command: readonly string[];
}) => Promise<boolean>;

const probeTimeoutMilliseconds = 5_000;

export async function probeCommand(options: {
  readonly command: readonly string[];
  readonly timeoutMilliseconds?: number;
}): Promise<boolean> {
  try {
    const process = Bun.spawn({
      cmd: [...options.command],
      stdout: "ignore",
      stderr: "ignore",
      timeout: options.timeoutMilliseconds ?? probeTimeoutMilliseconds,
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
  const installed = await probe({ command: ["claude", "--version"] });
  const authenticated =
    installed && (await probe({ command: ["claude", "auth", "status"] }));
  return { engine: "claude-code", installed, authenticated };
}

export async function detectCodex(options: {
  readonly probe?: CommandProbe;
} = {}): Promise<EngineAvailability> {
  const probe = options.probe ?? probeCommand;
  const installed = await probe({ command: ["codex", "--version"] });
  const authenticated =
    installed && (await probe({ command: ["codex", "login", "status"] }));
  return { engine: "codex", installed, authenticated };
}

export async function detectCursorAgent(options: {
  readonly probe?: CommandProbe;
} = {}): Promise<EngineAvailability> {
  const probe = options.probe ?? probeCommand;
  const installed = await probe({ command: ["cursor-agent", "--version"] });
  const authenticated =
    installed && (await probe({ command: ["cursor-agent", "status"] }));
  return { engine: "cursor-agent", installed, authenticated };
}

function getEngineRunner(engineId: EngineId): EngineRunner | null {
  if (engineId === "claude-code") {
    return runClaudeCode;
  }
  if (engineId === "codex") {
    return runCodex;
  }
  if (engineId === "cursor-agent") {
    return runCursorAgent;
  }
  return null;
}

function supportsPurpose(options: {
  readonly engineId: EngineId;
  readonly purpose: EnginePurpose;
}): boolean {
  const definition = getProviderByEngine(options.engineId);
  return (
    definition !== null &&
    providerSupportsPurpose({
      definition,
      purpose: options.purpose,
    })
  );
}

export async function detectEngine(options: {
  readonly purpose: EnginePurpose;
  readonly probe?: CommandProbe;
  readonly allowedEngines?: readonly EngineId[];
}): Promise<{
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
  const availability = [claudeCode, codex, cursorAgent];
  const selected = availability.find(
    (candidate) =>
      candidate.authenticated &&
      allowed.includes(candidate.engine) &&
      supportsPurpose({
        engineId: candidate.engine,
        purpose: options.purpose,
      }),
  );
  const runner = selected ? getEngineRunner(selected.engine) : null;
  return {
    availability,
    runner,
    selectedEngine: runner ? selected?.engine ?? null : null,
  };
}
