import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { defaultConfig, writeConfig } from "../../config";
import type { EngineRunner } from "../../engine";
import { canonicalPath, createProjectPaths } from "../../paths";
import { command } from "../transfer/command";
import { guidanceFixture, contractFixture } from "./fixtures";
import { runGuidanceEvaluation } from "./run";
import { guidanceDirectory, saveGuidanceSuite } from "./store";

test("a pilot resumes saved evidence and votes without resetting spend or its deadline", async () => {
  const directory = canonicalPath(
    await mkdtemp(path.join(os.tmpdir(), "guidance-resume-")),
  );
  const paths = createProjectPaths({
    homeDirectory: directory,
    platform: "freebsd",
  });

  try {
    await writeConfig({
      configPath: paths.configFile,
      config: {
        ...defaultConfig,
        sources: { ...defaultConfig.sources, "git-metadata": true },
        distillation: { deep: true },
      },
    });
    await command({ arguments: ["git", "init", "--quiet"], cwd: directory });
    await Bun.write(path.join(directory, "README.md"), "Fixture repository.\n");
    await command({ arguments: ["git", "add", "README.md"], cwd: directory });
    await command({
      arguments: [
        "git",
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@localhost",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "--quiet",
        "-m",
        "Fixture",
      ],
      cwd: directory,
    });

    const suite = {
      ...guidanceFixture(),
      repository: directory,
      baseCommit: await command({
        arguments: ["git", "rev-parse", "HEAD"],
        cwd: directory,
      }),
    };

    await saveGuidanceSuite({ paths, suite });

    let calls = 0;
    let executions = 0;

    const runner: EngineRunner = async (request) => {
      calls += 1;

      expect(request.model).toBe("claude-sonnet-5");
      expect(request.reasoningEffort).toBe("medium");
      expect(request.maxBudgetUsd).toBeCloseTo(5 - (calls - 1) / 100);

      if (!request.outputSchema) {
        executions += 1;

        if (
          request.execution.purpose === "evaluation" &&
          request.execution.access === "write"
        ) {
          await Bun.write(
            path.join(request.cwd, "result.ts"),
            "export const completeName = true;\n",
          );
        }
      }

      return {
        engine: "claude-code",
        resolvedModel: "claude-sonnet-5",
        sessionId: "fixture",
        transcriptPath: null,
        text: "Use a separate retry budget.",
        structured:
          calls === 3
            ? {}
            : {
                checks: [
                  {
                    id: "complete-names",
                    verdict: "pass",
                    evidence: "Uses complete names.",
                  },
                ],
              },
        costUsd: 0.01,
        durationMs: 0,
        turns: 1,
        isError: false,
        permissionDenials: [],
        actions: [],
        errorMessage: null,
      };
    };

    const options = {
      repo: directory,
      model: "claude-sonnet-5",
      pilot: true,
      maxBudgetUsd: 5,
      maximumCalls: 28,
      deadlineSeconds: 60,
      paths,
      runner,
      verifyContract: async () => contractFixture(),
    };

    const interrupted = await runGuidanceEvaluation({
      ...options,
      suiteId: suite.suiteId,
    });

    expect(interrupted.status).toBe("error");
    expect(interrupted.runs).toHaveLength(1);
    expect(interrupted.runs[0]?.votes).toHaveLength(1);

    const resumed = await runGuidanceEvaluation({
      ...options,
      evalId: interrupted.evalId,
      deadlineSeconds: 600,
    });

    expect(resumed.status).toBe("complete");
    expect(resumed.runs).toHaveLength(8);
    expect(resumed.deadlineAt).toBe(interrupted.deadlineAt);
    expect(executions).toBe(8);
    expect(calls).toBe(25);

    const budget = await Bun.file(
      path.join(
        guidanceDirectory({ paths, evalId: resumed.evalId }),
        "budget.json",
      ),
    ).json();

    expect(budget.spentUsd).toBeCloseTo(0.25);

    await runGuidanceEvaluation({ ...options, evalId: resumed.evalId });

    expect(calls).toBe(25);
    await expect(
      runGuidanceEvaluation({
        ...options,
        evalId: resumed.evalId,
        maximumCalls: 29,
      }),
    ).rejects.toThrow("original limits");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 30000);
