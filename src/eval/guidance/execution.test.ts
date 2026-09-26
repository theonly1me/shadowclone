import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { command } from "../transfer/command";
import { disposeSnapshotTemplates } from "../transfer/snapshot";
import { executeGuidance } from "./execute";
import { guidanceFixture } from "./fixtures";

test("read-only advice is valid evidence without code changes or test execution", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "guidance-advice-"));
  try {
    await command({ arguments: ["git", "init", "--quiet"], cwd: directory });
    await Bun.write(path.join(directory, "README.md"), "Fixture repository.\n");
    await command({ arguments: ["git", "add", "README.md"], cwd: directory });
    await command({ arguments: ["git", "-c", "user.name=Fixture", "-c", "user.email=fixture@localhost", "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "Fixture"], cwd: directory });
    const suite = { ...guidanceFixture(), repository: directory, baseCommit: await command({ arguments: ["git", "rev-parse", "HEAD"], cwd: directory }) };
    const scenario = suite.scenarios.find((entry) => entry.mode === "advice");
    if (!scenario) throw new Error("Advice fixture missing");
    const result = await executeGuidance({ suite, scenario, arm: "memory", repeat: 0, call: async (request) => {
      expect(request.access).toBe("read");
      expect(request.prompt).toContain("Read-only task");
      expect(await Bun.file(path.join(request.cwd, ".eval-context/memory/reference_queue.md")).exists()).toBeTrue();
      expect(await Bun.file(path.join(request.cwd, ".eval-context/references/reference_queue.md")).exists()).toBeFalse();
      return { engine: "claude-code", resolvedModel: "claude-sonnet-5", sessionId: "fixture", transcriptPath: null, text: "Use a separate retry budget.", structured: null, costUsd: 0,
        durationMs: 0, turns: 1, isError: false, permissionDenials: [], actions: [], errorMessage: null };
    } });
    expect(result.safety).toBe("pass");
    expect(result.verification).toBe("not-verified");
    expect(result.evidence).toContain("Use a separate retry budget.");
  } finally { await disposeSnapshotTemplates(); await rm(directory, { recursive: true, force: true }); }
});
