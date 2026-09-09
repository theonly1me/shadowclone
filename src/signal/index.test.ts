import { expect, test } from "bun:test";
import type {
  CorpusSummary,
  IndexedEvent,
} from "../index";
import { renderMirror } from "../profile";
import { deriveSignals, normalizeRemoteOrigin } from "./index";

const corpus: CorpusSummary = {
  sessions: 2,
  bytes: 2_097_152,
  activeDays: 1,
};

function event(options: {
  readonly id: number;
  readonly sessionId: string;
  readonly cwd: string;
  readonly kind: IndexedEvent["kind"];
  readonly toolName?: string;
}): IndexedEvent {
  return {
    id: options.id,
    sourcePath: "/fixture.jsonl",
    source: "claude-code",
    sessionId: options.sessionId,
    eventId: `event-${options.id}`,
    parentEventId: null,
    timestamp: 1_788_537_600_000 + options.id,
    cwd: options.cwd,
    gitBranch: "feat/mirror",
    kind: options.kind,
    tool: options.toolName
      ? { toolUseId: `tool-${options.id}`, name: options.toolName }
      : null,
    isError: false,
    textRef: null,
  };
}

const events = [
  event({
    id: 1,
    sessionId: "one",
    cwd: "/one",
    kind: "tool-call",
    toolName: "Edit",
  }),
  event({
    id: 2,
    sessionId: "one",
    cwd: "/one",
    kind: "interruption",
  }),
  event({
    id: 3,
    sessionId: "one",
    cwd: "/one",
    kind: "question-asked",
    toolName: "AskUserQuestion",
  }),
  event({
    id: 4,
    sessionId: "one",
    cwd: "/one",
    kind: "user-prompt",
  }),
  event({
    id: 5,
    sessionId: "two",
    cwd: "/two",
    kind: "tool-call",
    toolName: "Edit",
  }),
  event({
    id: 6,
    sessionId: "two",
    cwd: "/two",
    kind: "interruption",
  }),
] as const;

test("normalizes a remote to its organization without credentials", () => {
  expect(
    normalizeRemoteOrigin(
      "https://private-token@github.com/Acme/platform.git",
    ),
  ).toEqual({
    id: "github.com/acme",
    directoryName: "github.com--acme",
    promotable: true,
  });
});

test("does not read git metadata without separate consent", async () => {
  let reads = 0;
  const derived = await deriveSignals({
    events,
    corpus,
    gitMetadataEnabled: false,
    readRemote: () => {
      reads += 1;
      return Promise.resolve("git@github.com:acme/repo.git");
    },
  });

  expect(reads).toBe(0);
  expect(
    [...derived.origins.values()].every((origin) => !origin.promotable),
  ).toBeTrue();
});

test("mines correction markers and renders a text-free mirror", async () => {
  const derived = await deriveSignals({
    events,
    corpus,
    gitMetadataEnabled: true,
    readRemote: (cwd) =>
      Promise.resolve(
        cwd === "/one"
          ? "git@github.com:acme/repo.git"
          : "https://github.com/other/repo.git",
      ),
  });
  const output = renderMirror({
    report: derived.report,
    deepLearningPreview: {
      eligibleCorrectionMoments: 1,
      extractionBatches: 1,
    },
  });

  expect(derived.report.interruptions[0]?.label).toBe("while using Edit");
  expect(derived.report.originCount).toBe(2);
  expect(derived.report.correctionCounts).toEqual({
    interruptions: 2,
    permissionDenials: 0,
    answeredQuestions: 1,
    resolvedPlans: 0,
  });
  expect(
    derived.corrections.every((signal) => signal.repositoryName?.startsWith("repo--")),
  ).toBeTrue();
  expect(output).toContain("No network calls were made.");
  expect(output).toContain("while using Edit");
  expect(output).toContain("reconciliation batch");
  expect(output).toContain("Profile unchanged.");
  expect(output).not.toContain("Profile written");
  expect(output).not.toContain("/one");
});
