import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fastTier, runClaudeCode, runCodex, type EngineId, type EngineRunner } from "@shadowclone/agents";
import type { LiveEngine } from "@shadowclone/live";

export type BriefModelRequest = {
  readonly engine: LiveEngine;
  readonly prompt: string;
  readonly outputSchema: unknown;
  readonly signal: AbortSignal;
};

export type BriefModel = (request: BriefModelRequest) => Promise<unknown>;

const engines: Readonly<Record<LiveEngine, { readonly id: EngineId; readonly runner: EngineRunner }>> = {
  claude: { id: "claude-code", runner: runClaudeCode },
  codex: { id: "codex", runner: runCodex },
};

export function engineIdOf(engine: LiveEngine): EngineId {
  return engines[engine].id;
}

function parsedText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export const fastTierModel: BriefModel = async (request) => {
  const { id, runner } = engines[request.engine];
  const tier = fastTier({ engine: id, savedModel: undefined });
  const directory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-brief-"));

  try {
    const run = await runner({
      prompt: request.prompt,
      cwd: directory,
      execution: { purpose: "learning" },
      outputSchema: request.outputSchema,
      signal: request.signal,
      ...(tier.model === null ? {} : { model: tier.model }),
      ...(tier.reasoningEffort === null ? {} : { reasoningEffort: tier.reasoningEffort }),
      ...(tier.thinking === undefined ? {} : { thinking: tier.thinking }),
      ...(tier.systemPrompt === undefined ? {} : { systemPrompt: tier.systemPrompt }),
    });

    if (run.isError) {
      throw new Error(`The ${id} fast tier call failed.`);
    }

    return run.structured ?? parsedText(run.text);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};
