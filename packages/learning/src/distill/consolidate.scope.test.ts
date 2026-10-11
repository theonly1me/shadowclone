import { expect, test } from "bun:test";
import type { EngineRunner } from "@shadowclone/agents";
import { profileEvidenceId, type ProfileRule } from "@shadowclone/profile";
import { consolidateNewRules } from "./consolidate";

const originDirectory = "github.com--synthetic-owner";

function projectRule(options: {
  readonly key: string;
  readonly repositoryName: string;
}): ProfileRule {
  return {
    key: options.key,
    title: "Run the project checks",
    body: "Run the project checks before committing.",
    section: "workflow",
    scope: "project",
    originDirectory,
    repositoryName: options.repositoryName,
    source: "mined",
    status: "candidate",
    proposal: null,
    appliesWhen: [],
    evidence: {
      for: [
        profileEvidenceId({
          originId: "github.com/synthetic-owner",
          sessionId: options.key,
          timestamp: 1_788_537_600_000,
          kind: "question-answered",
          category: "agent-question",
        }),
      ],
      against: [],
    },
    observations: 1,
    sessions: 1,
    origins: ["github.com/synthetic-owner"],
    lastSeen: "2026-09-05",
    importReference: null,
  };
}

function mergeRunner() {
  const prompts: string[] = [];
  const runner: EngineRunner = (options) => {
    prompts.push(options.prompt);
    return Promise.resolve({
      engine: "claude-code",
      sessionId: "synthetic-merge",
      transcriptPath: null,
      text: "",
      structured: {
        rules: [
          {
            title: "Run the project checks",
            body: "Run the project checks before committing.",
            section: "workflow",
            sources: [0, 1],
          },
        ],
      },
      costUsd: 0,
      durationMs: 1,
      turns: 1,
      isError: false,
      permissionDenials: [],
      actions: [],
      errorMessage: null,
    });
  };

  return { runner, prompts };
}

test("two repositories under one origin retain their own rules and evidence", async () => {
  const rules = [
    projectRule({ key: "first", repositoryName: "repo-a" }),
    projectRule({ key: "second", repositoryName: "repo-b" }),
  ];
  const { runner, prompts } = mergeRunner();
  const result = await consolidateNewRules({ rules, runner, workingDirectory: "/tmp" });

  expect(result.rules).toEqual(rules);
  expect(prompts).toHaveLength(0);
});

test("organization and project guidance under one origin retain separate scopes", async () => {
  const project = projectRule({ key: "project", repositoryName: "repo-a" });
  const organization: ProfileRule = {
    ...project,
    key: "organization",
    scope: "org",
    originDirectory,
    repositoryName: null,
  };
  const global: ProfileRule = {
    ...project,
    key: "global",
    scope: "global",
    originDirectory: null,
    repositoryName: null,
  };
  const rules = [organization, project, global];
  const { runner, prompts } = mergeRunner();
  const result = await consolidateNewRules({ rules, runner, workingDirectory: "/tmp" });

  expect(result.rules).toEqual(rules);
  expect(prompts).toHaveLength(0);
});

test("duplicates merge only within their repository and retain its exact evidence", async () => {
  const first = projectRule({ key: "first", repositoryName: "repo-a" });
  const second = projectRule({ key: "second", repositoryName: "repo-a" });
  const third = projectRule({ key: "third", repositoryName: "repo-b" });
  const fourth = projectRule({ key: "fourth", repositoryName: "repo-b" });
  const { runner, prompts } = mergeRunner();
  const result = await consolidateNewRules({
    rules: [first, third, second, fourth],
    runner,
    workingDirectory: "/tmp",
  });

  expect(
    result.rules.map((rule) => ({
      repositoryName: rule.repositoryName,
      evidence: rule.evidence.for,
    })),
  ).toEqual([
    { repositoryName: "repo-a", evidence: [...first.evidence.for, ...second.evidence.for] },
    { repositoryName: "repo-b", evidence: [...third.evidence.for, ...fourth.evidence.for] },
  ]);
  expect(prompts).toHaveLength(2);
});
