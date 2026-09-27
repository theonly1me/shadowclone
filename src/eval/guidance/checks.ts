import ts from "typescript";
import type { GuidanceCheck, GuidanceScenario } from "./schema";

export type EvidenceFile = { readonly path: string; readonly content: string };

function syntaxFindings(file: EvidenceFile): readonly string[] {
  const diagnostics =
    ts.transpileModule(file.content, {
      fileName: file.path,
      reportDiagnostics: true,
    }).diagnostics ?? [];

  return diagnostics
    .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
    .map(
      (diagnostic) =>
        `${file.path}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`,
    );
}

function forbiddenSyntax(options: {
  readonly file: EvidenceFile;
  readonly check: string;
}): boolean {
  const source = ts.createSourceFile(
    options.file.path,
    options.file.content,
    ts.ScriptTarget.Latest,
    true,
  );

  let found = false;

  const visit = (node: ts.Node): void => {
    if (
      options.check === "zero-comments" &&
      ((ts.getLeadingCommentRanges(options.file.content, node.pos)?.length ??
        0) > 0 ||
        (ts.getTrailingCommentRanges(options.file.content, node.end)?.length ??
          0) > 0)
    ) {
      found = true;
    }

    if (
      options.check === "type-safety" &&
      (node.kind === ts.SyntaxKind.AnyKeyword ||
        ts.isNonNullExpression(node) ||
        ts.isTypeAssertionExpression(node) ||
        (ts.isAsExpression(node) &&
          !(
            ts.isTypeReferenceNode(node.type) &&
            ts.isIdentifier(node.type.typeName) &&
            node.type.typeName.text === "const"
          )))
    ) {
      found = true;
    }

    ts.forEachChild(node, visit);
  };

  visit(source);

  return found;
}

export function deterministicChecks(options: {
  readonly scenario: GuidanceScenario;
  readonly files: readonly EvidenceFile[];
}): {
  readonly checks: GuidanceCheck[];
  readonly verification: "not-verified" | "syntax-error";
} {
  const files = options.files.filter((file) => /\.[cm]?tsx?$/.test(file.path));
  const syntax = files.flatMap(syntaxFindings);

  return {
    verification: syntax.length > 0 ? "syntax-error" : "not-verified",
    checks: options.scenario.criteria
      .filter((criterion) => criterion.check !== "judged")
      .map((criterion) => {
        const violations = files.filter((file) =>
          criterion.check === "file-length"
            ? file.content.trimEnd().split("\n").length >= 200
            : forbiddenSyntax({ file, check: criterion.check }),
        );

        return {
          id: criterion.id,
          verdict:
            files.length === 0
              ? "unknown"
              : violations.length > 0
                ? "fail"
                : "pass",
          evidence:
            files.length === 0
              ? "No code evidence was produced."
              : violations.length > 0
                ? `Violations in ${violations.map((file) => file.path).join(", ")}`.slice(
                    0,
                    1200,
                  )
                : `Checked ${files.length} changed TypeScript file(s). Tests and typechecks were not executed.`,
        };
      }),
  };
}
