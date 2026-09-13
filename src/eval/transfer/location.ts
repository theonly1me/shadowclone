import { existsSync } from "node:fs";
import path from "node:path";
import type { ProjectPaths } from "../../paths";
import { readReceipt } from "./resume";
import type { TransferReceipt } from "./types";

export async function resolveEvaluationLocation(options: {
  readonly paths: ProjectPaths;
  readonly requestedId: string | undefined;
}): Promise<{
  readonly evalId: string;
  readonly directory: string;
  readonly saved: TransferReceipt | null;
}> {
  const evalId = options.requestedId ?? crypto.randomUUID();
  const evalDirectory = path.join(
    options.paths.shadowcloneDirectory,
    "eval",
  );

  if (options.requestedId) {
    const knownEvaluationIds = new Set<string>();

    if (existsSync(evalDirectory)) {
      const scanner = new Bun.Glob("*").scan({
        cwd: evalDirectory,
        onlyFiles: false,
      });
      for await (const entryName of scanner) {
        knownEvaluationIds.add(entryName);
      }
    }

    if (!knownEvaluationIds.has(options.requestedId)) {
      throw new Error("Unknown evaluation id");
    }
  }

  const directory = path.join(evalDirectory, evalId);
  const saved = options.requestedId
    ? readReceipt(
        await Bun.file(path.join(directory, "receipt.json")).text(),
      )
    : null;

  return { evalId, directory, saved };
}
