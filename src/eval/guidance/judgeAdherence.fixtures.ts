import { fingerprint } from "../transfer/structured";
import { sourceJudgePromptFingerprint } from "./judgePrompt";
import { checkedLocations } from "./sourceEvidence";
import type { SourceJudging } from "./sourceEvidenceSchema";

export function sourceJudgingFixture(version: 3 | 4): SourceJudging {
  const contents = [
    "The package test script invokes the test runner.",
    "The repository has a workspace task runner.",
    "The documented focused workflow forwards --testPathPatterns.",
    "A repository example uses task test widget -- src/widget.test.ts.",
    "Run the focused command from the repository root. Verified 2026-09-08.",
    "Mock used exports directly. Importing the mocked module inside its factory recurses.",
  ];
  const packet = {
    commit: "synthetic-commit",
    documents: contents.map((content, index) => ({ id: `source-${index + 1}`, contentHash: fingerprint(content), numberedContent: `1: ${content}` })),
    locations: checkedLocations.map((location, index) => ({ path: location, exists: index % 2 === 1 })),
  };
  return { version, promptFingerprint: sourceJudgePromptFingerprint(version), packetFingerprint: fingerprint(packet), packet,
    provenance: contents.map((content, index) => ({ id: `source-${index + 1}`, path: `private-source-${index + 1}`, sourceHash: fingerprint(content) })) };
}

export const adherenceCases = [
  {
    name: "documented alternatives do not imply compliance with a prescribed workflow",
    requirement: "Use the explicit filtering flag.", response: "task test widget -- src/widget.test.ts",
    contract: "A documented alternative can still fail an explicitly required workflow",
  },
  {
    name: "permitted alternatives need no invented exact syntax requirement",
    requirement: "Give a documented focused command.", response: "task test widget -- src/widget.test.ts",
    contract: "When a criterion permits alternatives, accept documented alternatives that satisfy its requirements",
  },
  {
    name: "a root-directory requirement does not prove another real directory fails at runtime",
    requirement: "Invoke the task runner from the repository root.", response: "From a real package directory, invoke the task runner.",
    contract: "does not prove that an invocation from a real package directory cannot resolve the workspace",
  },
  {
    name: "the requested mock strategy and the recursion cause are judged separately",
    requirement: "Mock used exports directly.", response: "Import the original before registration, then spread it in the factory.",
    contract: "Do not assert that a pre-import outside the mock factory recurses solely because importing inside the factory does",
  },
  {
    name: "a runnable alternative does not excuse a concrete nonexistent-directory recommendation",
    requirement: "Every recommended runnable command uses an existing directory.",
    response: "Use services/example, or cd packages/example and run the tests.",
    contract: "A concrete nonexistent directory in the frozen location evidence is a source-backed conflict",
  },
  {
    name: "historical attribution is preserved without claiming current execution",
    requirement: "Do not claim execution in the current session.", response: "The recorded source verified this on 2026-09-08. I did not run it.",
    contract: "not a claim of execution in the current session",
  },
  {
    name: "criterion-level uncertainty remains unknown",
    requirement: "Explain whether the command selects one test file.", response: "Its filtering behavior is not established by these sources.",
    contract: "If uncertainty prevents deciding the criterion itself, return unknown",
  },
] as const;
