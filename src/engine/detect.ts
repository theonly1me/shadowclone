import type {
  EngineAvailability,
  EngineRunner,
} from "./types";
import { runClaudeCode } from "./claudeCode";

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

export async function detectEngine(options: {
  readonly probe?: CommandProbe;
} = {}): Promise<{
  readonly availability: readonly EngineAvailability[];
  readonly runner: EngineRunner | null;
}> {
  const claudeCode = await detectClaudeCode(options);
  return {
    availability: [claudeCode],
    runner: claudeCode.authenticated ? runClaudeCode : null,
  };
}
