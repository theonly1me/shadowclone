import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { armNames } from "./arms";
import { greptileFindings, type NormalizedFinding, openqodexFindings, shadowcloneFindings } from "./normalize";

const runSchema = z.object({ arm: z.enum(armNames), caseId: z.string(), status: z.string(), startedAt: z.string(), finishedAt: z.string().nullable(), raw: z.unknown() });

export type RunSummary = { readonly arm: string; readonly caseId: string; readonly done: boolean; readonly seconds: number | null };

export function collectFindings(options: { readonly runs: string; readonly caseIds: readonly string[] }) {
  const findingsByCase = new Map<string, NormalizedFinding[]>();
  const summaries: RunSummary[] = [];

  for (const arm of armNames) {
    for (const caseId of options.caseIds) {
      const file = path.join(options.runs, arm, caseId, "run.json");

      if (!existsSync(file)) {
        summaries.push({ arm, caseId, done: false, seconds: null });
        continue;
      }

      const run = runSchema.parse(JSON.parse(readFileSync(file, "utf8")));
      const done = run.status === "done" && run.raw !== null;
      const findings = !done
        ? []
        : arm === "shadowclone"
          ? shadowcloneFindings({ caseId, raw: run.raw, startedAt: run.startedAt })
          : arm === "greptile"
            ? greptileFindings({ caseId, raw: run.raw, startedAt: run.startedAt })
            : openqodexFindings({ caseId, raw: run.raw });

      findingsByCase.set(caseId, [...(findingsByCase.get(caseId) ?? []), ...findings]);
      summaries.push({
        arm,
        caseId,
        done,
        seconds: run.finishedAt === null ? null : Math.round((Date.parse(run.finishedAt) - Date.parse(run.startedAt)) / 1000),
      });
    }
  }

  return { findingsByCase, summaries };
}
