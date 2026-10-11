import { expect, test } from "bun:test";
import path from "node:path";
import { parseGuidedOpen } from "./reviewOpen";

test("guided open keeps report, checkout, personal review guidance, and engine selection separate", () => {
  const options = parseGuidedOpen([
    "report.html",
    "--checkout",
    "/tmp/example-repository",
    "--engine",
    "codex",
    "--review-skill",
    "/tmp/example-review/SKILL.md",
    "--no-open",
  ]);
  expect(options.file).toBe(path.resolve("report.html"));
  expect(options.checkout).toBe("/tmp/example-repository");
  expect(options.preferredEngine).toBe("codex");
  expect(options.reviewSkill).toBe("/tmp/example-review/SKILL.md");
  expect(options.open).toBeFalse();
});

test("guided open rejects unknown engines and duplicate scope arguments", () => {
  expect(() => parseGuidedOpen(["report.html", "--engine", "another"])).toThrow(
    "Use shadowclone review open",
  );
  expect(() =>
    parseGuidedOpen(["report.html", "--checkout", "one", "--checkout", "two"]),
  ).toThrow();
});
