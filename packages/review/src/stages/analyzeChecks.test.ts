import { expect, test } from "bun:test";
import type { EngineRunOptions } from "@shadowclone/agents";
import { collectReview } from "../collect";
import { createGitFixture } from "../collect/gitFixture";
import { engineRun } from "../engineFixture";
import { analyzeStage } from "./analyze";
import type { ChecksFile, PacketFile } from "./schemas";

async function packetFixture(): Promise<{
  readonly packet: PacketFile;
  readonly checkout: string;
}> {
  const fixture = await createGitFixture();
  await fixture.write({
    "src/total.ts": "export function total(price: number): number {\n  return price;\n}\n",
  });
  const baseSha = fixture.commit("base");
  await fixture.write({
    "src/total.ts": "export function total(price: number): string {\n  return price;\n}\n",
  });
  const headSha = fixture.commit("head");
  const context = await collectReview({
    checkout: fixture.directory,
    facts: {
      repository: "example/app",
      number: 1,
      title: "t",
      body: "",
      baseRefName: "main",
      baseSha,
      headSha,
    },
  });

  return {
    packet: { version: 1, context, ruleHits: [], reports: [] },
    checkout: fixture.directory,
  };
}

function checksWith(options: {
  readonly headSha: string;
  readonly diagnostics: number;
}): ChecksFile {
  const diagnostics = Array.from({ length: options.diagnostics }, () => ({
    tool: "typecheck",
    path: "src/total.ts",
    line: 2,
    message: "Type 'number' is not assignable to type 'string'.",
  }));

  return {
    version: 1,
    headSha: options.headSha,
    reports: [{ stack: "javascript", tool: "typecheck", status: "ran", detail: "", diagnostics }],
  };
}

function waitingChecks(): {
  readonly promise: Promise<ChecksFile | null>;
  readonly finish: (checks: ChecksFile) => void;
} {
  let finish: (checks: ChecksFile) => void = () => {};
  const promise = new Promise<ChecksFile | null>((resolve) => {
    finish = resolve;
  });

  return { promise, finish };
}

test("the model starts before the checks finish, and a late diagnostic gets its decision in the correction round", async () => {
  const { packet, checkout } = await packetFixture();
  const checks = waitingChecks();
  const prompts: string[] = [];
  const runner = async (run: EngineRunOptions) => {
    prompts.push(run.prompt);

    if (prompts.length === 1) {
      checks.finish(checksWith({ headSha: packet.context.facts.headSha, diagnostics: 1 }));
      return engineRun({ structured: { findings: [], dropped: [] } });
    }

    return engineRun({
      structured: {
        findings: [],
        dropped: [{ id: "T1", reason: "The caller converts the number." }],
      },
    });
  };

  const result = await analyzeStage({
    packet,
    checks: checks.promise,
    checkout,
    reviewModel: { runner, model: "m", effort: "high", network: false },
  });

  expect(prompts).toHaveLength(2);
  expect(prompts[0]).not.toContain('"id": "T1"');
  expect(prompts[1]).toContain("T1 have no decision");
  expect(result.candidates.dropped.map((entry) => entry.id)).toEqual(["T1"]);
});

test("checks that finish late with no new diagnostic need no correction round", async () => {
  const { packet, checkout } = await packetFixture();
  const checks = waitingChecks();
  const prompts: string[] = [];
  const runner = async (run: EngineRunOptions) => {
    prompts.push(run.prompt);
    checks.finish(checksWith({ headSha: packet.context.facts.headSha, diagnostics: 0 }));
    return engineRun({ structured: { findings: [], dropped: [] } });
  };

  const result = await analyzeStage({
    packet,
    checks: checks.promise,
    checkout,
    reviewModel: { runner, model: "m", effort: "high", network: false },
  });

  expect([
    prompts.length,
    result.statistics.correctionRound,
    result.toolchain.map((entry) => entry.tool),
  ]).toEqual([1, "none", ["typecheck"]]);
});
