import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { redactSecrets } from "../redact";
import { runProcess } from "../io/process";
import { runnerEnvironment } from "./environment";
import { isolatedCodexHome, userCodexHome } from "./codexHome";
import {
  buildCodexArguments,
  codexProcessArguments,
  validateCodexOptions,
} from "./codexArguments";
import { isIsolatedExecution } from "./execution";
import { parseCodexStream } from "./parseCodex";
import { buildEnginePrompt } from "./prompt";
import type { EngineRun, EngineRunOptions } from "./types";

export { buildCodexArguments, codexProcessArguments };

export function codexProcessEnvironment(options: {
  readonly temporaryDirectory?: string;
  readonly environment?: NodeJS.ProcessEnv;
  readonly userHome?: string;
  readonly codexHome?: string;
}): NodeJS.ProcessEnv {
  const source = options.environment ?? process.env;
  const environment = runnerEnvironment({ engine: "codex", source });
  if (!options.temporaryDirectory) {
    return environment;
  }

  return {
    ...environment,
    HOME: options.temporaryDirectory,
    TMPDIR: options.temporaryDirectory,
    TMP: options.temporaryDirectory,
    TEMP: options.temporaryDirectory,
    CODEX_HOME: options.codexHome ??
      userCodexHome({ environment: source, userHome: options.userHome }),
  };
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
  const temporaryDirectory = isIsolatedExecution(options.run)
    ? await mkdtemp(
        path.join(
          process.platform === "darwin" ? "/private/tmp" : "/tmp",
          "shadowclone-codex-",
        ),
      )
    : undefined;
  try {
    const codexHome = temporaryDirectory
      ? await isolatedCodexHome({ temporaryDirectory })
      : undefined;
    const { exitCode, stdout: stream, stderr } = await runProcess({
      arguments: codexProcessArguments({
        arguments: buildCodexArguments({
          ...options,
          temporaryDirectory,
        }),
        run: options.run,
        temporaryDirectory,
      }),
      cwd: options.run.cwd,
      input: prompt,
      signal: options.run.signal,
      environment: codexProcessEnvironment({ temporaryDirectory, ...(codexHome ? { codexHome } : {}) }),
    });

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
  } finally {
    if (temporaryDirectory) {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }
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
