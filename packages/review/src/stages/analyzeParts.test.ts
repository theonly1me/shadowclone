import { expect, test } from "bun:test";
import type { EngineRunOptions } from "@shadowclone/agents";
import { collectReview } from "../collect";
import { createGitFixture } from "../collect/gitFixture";
import { engineRun } from "../engineFixture";
import type { Finding } from "../types";
import { analyzeStage } from "./analyze";
import type { PacketFile } from "./schemas";

const linesPerFile = 2_000;

function sourceLine(line: number): string {
  return `export const value${line} = ${line};`;
}

function source(): string {
  return `${Array.from({ length: linesPerFile }, (_, index) => sourceLine(index + 1)).join("\n")}\n`;
}

async function packetFor(
  paths: readonly string[],
): Promise<{ readonly packet: PacketFile; readonly checkout: string }> {
  const fixture = await createGitFixture();
  await fixture.write({ "README.md": "base\n" });
  const baseSha = fixture.commit("base");
  await fixture.write(Object.fromEntries(paths.map((filePath) => [filePath, source()])));
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

function finding(options: { readonly path: string; readonly line: number }): Finding {
  return {
    path: options.path,
    line: options.line,
    severity: "medium",
    category: "correctness",
    source: "investigation",
    title: `Wrong value at ${options.line}`,
    explanation: "The value is wrong.",
    failureScenario: "A caller reads the wrong value.",
    evidence: [
      {
        source: "code",
        location: `${options.path}:${options.line}`,
        quote: sourceLine(options.line),
      },
    ],
    rule: null,
    suggestion: null,
    refutation: "Nothing corrects it.",
    candidates: [],
  };
}

function runnerFor(options: {
  readonly paths: readonly string[];
  readonly findingsPerPath: number;
  readonly prompts: string[];
}) {
  return async (run: EngineRunOptions) => {
    options.prompts.push(run.prompt);
    const reviewed = options.paths.filter((filePath) => run.prompt.includes(`+++ b/${filePath}`));
    const findings = reviewed.flatMap((filePath) =>
      Array.from({ length: options.findingsPerPath }, (_, index) =>
        finding({ path: filePath, line: 2 + index * 8 }),
      ),
    );

    return engineRun({ structured: { findings, dropped: [] } });
  };
}

const reviewModel = (runner: ReturnType<typeof runnerFor>) => ({
  runner,
  model: "m",
  effort: "high" as const,
  network: false,
});

test("a diff over the packet limit is reviewed in parts, and every changed file reaches exactly one reviewer", async () => {
  const paths = ["src/a.ts", "src/b.ts", "src/c.ts"];
  const { packet, checkout } = await packetFor(paths);
  const prompts: string[] = [];

  const result = await analyzeStage({
    packet,
    checks: null,
    checkout,
    reviewModel: reviewModel(runnerFor({ paths, findingsPerPath: 1, prompts })),
  });

  expect(prompts).toHaveLength(2);
  expect(
    paths.map(
      (filePath) => prompts.filter((prompt) => prompt.includes(`+++ b/${filePath}`)).length,
    ),
  ).toEqual([1, 1, 1]);
  expect(result.statistics.parts).toBe(2);
  expect(result.findings.map((entry) => entry.path).sort()).toEqual(paths);
});

test("a review in two parts keeps up to 20 findings, and a review in one part keeps 10", async () => {
  const large = ["src/a.ts", "src/b.ts", "src/c.ts"];
  const small = ["src/a.ts"];
  const largePacket = await packetFor(large);
  const smallPacket = await packetFor(small);

  const largeResult = await analyzeStage({
    ...largePacket,
    checks: null,
    reviewModel: reviewModel(runnerFor({ paths: large, findingsPerPath: 9, prompts: [] })),
  });
  const smallResult = await analyzeStage({
    ...smallPacket,
    checks: null,
    reviewModel: reviewModel(runnerFor({ paths: small, findingsPerPath: 15, prompts: [] })),
  });

  expect([largeResult.findings.length, smallResult.findings.length]).toEqual([20, 10]);
});
