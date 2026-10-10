import { expect, test } from "bun:test";
import { parseDiff } from "../collect/diff";
import type { CommandReport, Diagnostic } from "../toolchain";
import { linterHits } from "./linters";

function report(diagnostics: readonly Diagnostic[]): CommandReport {
  return {
    stack: "lint",
    tool: diagnostics[0]?.tool ?? "x",
    status: "ran",
    detail: "",
    diagnostics,
  };
}

const dockerfile = (line: number, message: string): Diagnostic => ({
  tool: "hadolint",
  path: "Dockerfile",
  line,
  message,
});

test("hadolint warnings on one line become one certain finding, and info notes stay candidates", () => {
  const result = linterHits({
    files: [],
    reports: [
      report([
        dockerfile(3, "DL3008 warning: Pin versions in apt get install."),
        dockerfile(3, "DL3014 warning: Use the `-y` switch to avoid manual input."),
        dockerfile(
          3,
          "DL3015 info: Avoid additional packages by specifying `--no-install-recommends`",
        ),
      ]),
    ],
  });

  expect(result.hits.map((hit) => [hit.level, hit.path, hit.line, hit.severity])).toEqual([
    ["certain", "Dockerfile", 3, "low"],
  ]);
  expect(result.hits[0]?.failure).toContain("DL3014");
  expect(result.reports[0]?.diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
    "DL3015 info: Avoid additional packages by specifying `--no-install-recommends`",
  ]);
});

test("a linter error is medium severity and a trivy HIGH check is high severity", () => {
  const result = linterHits({
    files: [],
    reports: [
      report([
        {
          tool: "shellcheck",
          path: "deploy.sh",
          line: 11,
          message: "error: Iterating over ls output is fragile. Use globs. [SC2045]",
        },
      ]),
      report([
        {
          tool: "trivy",
          path: "Dockerfile",
          line: 1,
          message: "HIGH DS-0002: Image user should not be 'root'",
        },
      ]),
    ],
  });

  expect(result.hits.map((hit) => [hit.ruleId, hit.severity, hit.category])).toEqual([
    ["shellcheck", "medium", "correctness"],
    ["trivy", "high", "security"],
  ]);
});

test("compiler and test diagnostics stay candidates for the model to check", () => {
  const typecheck: Diagnostic = {
    tool: "typecheck",
    path: "src/a.ts",
    line: 4,
    message: "error TS2345: Argument of type 'string'",
  };
  const result = linterHits({ files: [], reports: [report([typecheck])] });

  expect(result.hits).toEqual([]);
  expect(result.reports[0]?.diagnostics).toEqual([typecheck]);
});

test("checks that share a line take the title and severity of the most severe one", () => {
  const result = linterHits({
    files: [],
    reports: [
      report([
        {
          tool: "trivy",
          path: "Dockerfile",
          line: 1,
          message: "MEDIUM DS-0001: ':latest' tag used",
        },
        {
          tool: "trivy",
          path: "Dockerfile",
          line: 1,
          message: "HIGH DS-0002: Image user should not be 'root'",
        },
      ]),
    ],
  });

  expect(result.hits.map((hit) => [hit.severity, hit.title])).toEqual([
    ["high", "trivy: HIGH DS-0002: Image user should not be 'root'"],
  ]);
});

test("a check about the whole file sits on the last line that the change adds to it", () => {
  const files = parseDiff(
    [
      "diff --git a/Dockerfile b/Dockerfile",
      "--- a/Dockerfile",
      "+++ b/Dockerfile",
      "@@ -1,4 +1,3 @@",
      " FROM python:3.12",
      "-RUN useradd app",
      "-USER app",
      "+RUN pip install flask",
      '+CMD ["python", "app.py"]',
      "",
    ].join("\n"),
  );
  const result = linterHits({
    files,
    reports: [
      report([
        {
          tool: "trivy",
          path: "Dockerfile",
          line: 1,
          message: "HIGH DS-0002: Image user should not be 'root'",
          fileLevel: true,
        },
      ]),
    ],
  });

  expect(result.hits.map((hit) => [hit.path, hit.line])).toEqual([["Dockerfile", 3]]);
});
