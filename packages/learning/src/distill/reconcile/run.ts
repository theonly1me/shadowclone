import { redactSecrets } from "@shadowclone/redact";
import type { EngineRunner } from "@shadowclone/agents";
import { readCheckpoint, writeCheckpoint } from "../checkpoint";
import {
  parseReconciliationOutput,
  reconciliationOutputSchema,
} from "./schema";
import type { ReconciliationOutput } from "./types";

export function structuredValue(options: {
  readonly run: { readonly structured: unknown; readonly text: string };
  readonly purpose: string;
}): unknown {
  if (options.run.structured !== null && options.run.structured !== undefined) {
    return options.run.structured;
  }

  try {
    return JSON.parse(options.run.text);
  } catch {
    throw new Error(`The engine returned no structured ${options.purpose} result`);
  }
}

export async function runReconciliation(options: {
  readonly prompt: string;
  readonly runner: EngineRunner;
  readonly workingDirectory: string;
  readonly checkpointDirectory?: string;
}): Promise<ReconciliationOutput> {
  const checkpoint = options.checkpointDirectory
    ? await readCheckpoint({
        checkpointDirectory: options.checkpointDirectory,
        prompt: options.prompt,
      })
    : null;

  if (checkpoint) {
    return checkpoint;
  }

  const run = await options.runner({
    prompt: options.prompt,
    cwd: options.workingDirectory,
    execution: { purpose: "learning" },
    allowedTools: [],
    permissionMode: "dontAsk",
    outputSchema: reconciliationOutputSchema,
  });

  if (run.isError) {
    throw new Error(
      `The agent engine failed during reconciliation: ${redactSecrets({ text: run.errorMessage ?? "no engine detail" })}`,
    );
  }

  const output = parseReconciliationOutput(structuredValue({ run, purpose: "reconciliation" }));

  if (options.checkpointDirectory) {
    await writeCheckpoint({
      checkpointDirectory: options.checkpointDirectory,
      prompt: options.prompt,
      output,
    });
  }

  return output;
}
