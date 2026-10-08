import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { runProcess } from "../../../src/io/process";
import type { ArmRunner } from "./types";

export const openqodexVersion = "0.10.0";

export const runOpenqodex = (options: { readonly checkout: string; readonly model: string }): ArmRunner =>
  async ({ entry, directory }) => {
    const startedAt = new Date().toISOString();
    const reportDirectory = path.join(directory, "report");

    mkdirSync(reportDirectory, { recursive: true });

    const result = await runProcess({
      arguments: [
        "npx",
        "-y",
        `openqodex@${openqodexVersion}`,
        "review",
        `#${entry.number}`,
        "--reviewer",
        "claude",
        "--reviewer-web",
        "on",
        "--timeout",
        "1800",
        "--report-dir",
        reportDirectory,
        "--format",
        "json",
      ],
      cwd: options.checkout,
      environment: { ...process.env, ANTHROPIC_MODEL: options.model },
      timeoutMilliseconds: 40 * 60_000,
    }).catch((error: unknown) => ({ exitCode: -1, stdout: "", stderr: error instanceof Error ? error.message : String(error) }));
    const reportFile = path.join(reportDirectory, "report.json");
    const report: unknown = existsSync(reportFile) ? JSON.parse(readFileSync(reportFile, "utf8")) : null;

    return {
      arm: "openqodex",
      caseId: entry.id,
      number: entry.number,
      startedAt,
      finishedAt: new Date().toISOString(),
      status: report === null ? "failed" : "done",
      detail: `exit ${result.exitCode}: ${result.stderr.trim().split("\n").slice(-3).join(" | ").slice(0, 400)}`,
      raw: report,
    };
  };
