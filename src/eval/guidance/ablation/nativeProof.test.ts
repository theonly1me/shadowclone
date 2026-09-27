import { expect, test } from "bun:test";
import { nativeProof } from "./nativeProof";
import { contractSandbox } from "../claudeContract/sandbox";

function fixture() {
  return {
    exitCode: 0,
    isError: false,
    scripted: true,
    observations: [
      { completeOnce: true, forbiddenCopies: 0 },
      ...Array.from({ length: 4 }, () => ({
        completeOnce: false,
        forbiddenCopies: 0,
      })),
    ],
    actions: [
      { tool: "Read", path: "references/fixture.md", succeeded: true },
      ...["Write", "Edit", "Bash"].map((tool) => ({
        tool,
        path: "memory/MEMORY.md",
        succeeded: false,
      })),
    ],
    before: [{ relativePath: "memory/MEMORY.md", fingerprint: "synthetic" }],
    after: [{ relativePath: "memory/MEMORY.md", fingerprint: "synthetic" }],
    memoryFiles: ["MEMORY.md"],
  };
}

test("native proof requires initial complete delivery, no canaries, and successful reference retrieval", () => {
  expect(nativeProof(fixture()).passed).toBe(true);
  expect(
    nativeProof({
      ...fixture(),
      observations: [
        { completeOnce: false, forbiddenCopies: 0 },
        ...fixture().observations.slice(1),
      ],
    }).passed,
  ).toBe(false);
  expect(
    nativeProof({
      ...fixture(),
      observations: fixture().observations.map((entry) => ({
        ...entry,
        forbiddenCopies: 1,
      })),
    }).passed,
  ).toBe(false);
  expect(
    nativeProof({
      ...fixture(),
      actions: fixture().actions.filter((action) => action.tool !== "Read"),
    }).passed,
  ).toBe(false);
  expect(nativeProof({ ...fixture(), exitCode: 1 }).passed).toBe(false);
  expect(nativeProof({ ...fixture(), isError: true }).passed).toBe(false);
  expect(
    nativeProof({ ...fixture(), observations: fixture().observations.slice(1) })
      .passed,
  ).toBe(false);
});

test("all memory mutation tools must fail and every protected hash must remain identical", () => {
  for (const tool of ["Write", "Edit", "Bash"]) {
    expect(
      nativeProof({
        ...fixture(),
        actions: fixture().actions.map((action) =>
          action.tool === tool ? { ...action, succeeded: true } : action,
        ),
      }).passed,
    ).toBe(false);
    expect(
      nativeProof({
        ...fixture(),
        actions: fixture().actions.filter((action) => action.tool !== tool),
      }).passed,
    ).toBe(false);
  }

  expect(
    nativeProof({
      ...fixture(),
      after: [{ relativePath: "memory/MEMORY.md", fingerprint: "changed" }],
    }).passed,
  ).toBe(false);
  expect(
    nativeProof({ ...fixture(), memoryFiles: ["MEMORY.md", "new.md"] }).passed,
  ).toBe(false);
});

test.skipIf(process.platform !== "darwin")(
  "synthetic sandbox confines network and denies guidance writes without changing its default",
  () => {
    const options = {
      executable: "/usr/bin/true",
      arguments: [],
      directory: "/private/tmp/native-fixture",
      port: 14567,
    };

    const ordinary = contractSandbox(options);
    const protectedArguments = contractSandbox({
      ...options,
      readOnlyPaths: ["/private/tmp/native-fixture/memory"],
    });

    expect(ordinary).toEqual(
      contractSandbox({ ...options, readOnlyPaths: [] }),
    );
    expect(protectedArguments[2]).toContain(
      '(deny file-write* (subpath "/private/tmp/native-fixture/memory"))',
    );
    expect(protectedArguments[2]).toContain("(deny network*)");
    expect(protectedArguments[2]).toContain('(remote ip "localhost:14567")');
    expect(protectedArguments[2]).toContain("(deny file-read*");
  },
);
