import { sourceRules } from "./preferenceRules";
import { fingerprint } from "./structured";
import { codeRubricVersion, criterionInterpretation } from "./rubricScope";
import type { ContextFile, PreferenceCheck } from "./types";

export const codingCriteria = [
  { id: "type-safety", pattern: /(?:no|never|avoid).*\bany\b.*(?:casts|assertions|non-null)/i },
  { id: "options-object", pattern: /(?:two or more|multiple) arguments.*(?:options object|single options)/i },
  { id: "no-void-promises", pattern: /never.*void.*promise/i },
  { id: "complete-names", pattern: /(?:full words|use (?:complete|full) (?:variable )?names)/i },
  { id: "file-length", pattern: /keep every file under 200 lines/i },
  { id: "public-module-boundary", pattern: /index\.ts.*only thing consumers see/i },
  { id: "no-lint-suppression", pattern: /never silence.*lint rule/i },
  { id: "zero-comments", pattern: /write zero comments/i },
  { id: "identifier-case", pattern: /prefer kebab case for strings/i },
  { id: "abbreviation-case", pattern: /use lowercase camelCase for abbreviations/i },
  { id: "no-shouting", pattern: /avoid shouting/i },
  { id: "generic-names", pattern: /use proper names for generic type parameters/i },
  { id: "local-names", pattern: /use local names:/i },
  { id: "feature-organization", pattern: /instead of organizing.*form.*organize it by meaning/i },
  { id: "colocated-tests", pattern: /implement tests close to the code they cover/i },
  { id: "composition", pattern: /avoid class inheritance/i },
  { id: "test-local-setup", pattern: /put setup code at the start of each individual test/i },
] as const;

function paragraphs(source: ContextFile): readonly PreferenceCheck[] {
  return sourceRules(source).flatMap((block) => {
    const quotes: PreferenceCheck[] = [];
    let fenced = false;
    let paragraph: string[] = [];
    let line = block.source.line;
    const flush = () => {
      const requirement = paragraph.join("\n").trim();
      if (requirement) {
        quotes.push({ requirement, source: { ...block.source, line } });
      }
      paragraph = [];
    };
    for (const [offset, text] of block.requirement.split("\n").entries()) {
      if (/^\s*(```|~~~)/.test(text)) {
        flush();
        fenced = !fenced;
      } else if (!fenced) {
        if (!text.trim()) {
          flush();
        } else {
          if (paragraph.length === 0) line = block.source.line + offset;
          paragraph.push(text);
        }
      }
    }
    flush();
    return quotes;
  });
}

export function compileCodeRubric(sources: readonly ContextFile[]): readonly PreferenceCheck[] {
  const quotes = [...sources.filter((source) => source.relativePath !== "profile.md"),
    ...sources.filter((source) => source.relativePath === "profile.md")].flatMap(paragraphs);
  return codingCriteria.flatMap((criterion) => {
    const quote = quotes.find((candidate) => criterion.pattern.test(candidate.requirement));
    if (!quote) return [];
    const interpretation = criterionInterpretation(criterion.id);
    return [{
      ...quote,
      rubric: {
        version: codeRubricVersion,
        id: criterion.id,
        fingerprint: fingerprint({ requirement: quote.requirement, interpretation }),
        ...(interpretation === null ? {} : { interpretation }),
        scope: "changed-code-and-tests" as const,
        override: "Explicit task requirements override conflicting preferences only within their required scope. A required API signature does not exempt internal helpers. Existing unchanged code is outside scope.",
      },
    }];
  });
}
