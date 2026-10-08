import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { type CopiedCase, copiedCaseSchema } from "../copy";
import { inBatches } from "../github";
import { runGreptile } from "./greptile";
import { runOpenqodex } from "./openqodex";
import { runShadowclone } from "./shadowclone";
import type { ArmName, ArmRun, ArmRunner } from "./types";

export { armNames, type ArmName, type ArmRun } from "./types";

const parallelRuns: Readonly<Record<ArmName, number>> = { shadowclone: 10, greptile: 10, openqodex: 3 };

function runnerFor(options: { readonly arm: ArmName; readonly checkout: string; readonly model: string }): ArmRunner {
  if (options.arm === "shadowclone") {
    return runShadowclone;
  }

  return options.arm === "greptile" ? runGreptile : runOpenqodex({ checkout: options.checkout, model: options.model });
}

export async function runArm(options: {
  readonly arm: ArmName;
  readonly mined: string;
  readonly runs: string;
  readonly evalRepository: string;
  readonly checkout: string;
  readonly model: string;
  readonly only?: readonly string[];
}): Promise<readonly ArmRun[]> {
  const copied = z.array(copiedCaseSchema).parse(JSON.parse(readFileSync(path.join(options.mined, "copied.json"), "utf8")));
  const runner = runnerFor(options);
  const cases = copied.filter((entry) => options.only === undefined || options.only.includes(entry.id));

  return inBatches({
    items: cases,
    size: parallelRuns[options.arm],
    work: async (entry: CopiedCase) => {
      const directory = path.join(options.runs, options.arm, entry.id);

      mkdirSync(directory, { recursive: true });

      const run = await runner({ entry, evalRepository: options.evalRepository, directory });

      writeFileSync(path.join(directory, "run.json"), JSON.stringify(run, null, 2));
      console.error(`${options.arm} ${entry.id}: ${run.status} (${run.detail})`);
      return run;
    },
  });
}
