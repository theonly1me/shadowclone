import type { ContextFile, PreferenceCheck } from "./types";

export function preferenceSources(options: {
  readonly context: readonly ContextFile[];
  readonly profile: string;
}): readonly ContextFile[] {
  return [
    ...options.context,
    { relativePath: "profile.md", content: options.profile },
  ].filter((source) => source.content.trim().length > 0);
}

export function sourceRules(source: ContextFile): readonly PreferenceCheck[] {
  const lines = source.content.split("\n");
  const rules: PreferenceCheck[] = [];
  const headings: { readonly level: number; readonly text: string }[] = [];
  let block: string[] = [];
  let startLine = 1;
  let fence: string | undefined;
  let frontmatter = lines[0]?.trim() === "---";
  const flush = () => {
    const requirement = block.join("\n").trim();
    if (requirement) {
      rules.push({
        requirement,
        source: {
          relativePath: source.relativePath,
          heading: headings.map((heading) => heading.text).join(" > "),
          line: startLine,
        },
      });
    }
    block = [];
  };
  for (const [lineIndex, line] of lines.entries()) {
    if (frontmatter) {
      if (lineIndex > 0 && /^(?:---|\.\.\.)\s*$/.test(line)) {
        frontmatter = false;
      }
      continue;
    }
    const delimiter = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      block.push(line);
      if (delimiter?.startsWith(fence) && line.trim() === delimiter) {
        fence = undefined;
      }
      continue;
    }
    const heading = /^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    const level = heading?.[1]?.length;
    const title = heading?.[2];
    if (level && title) {
      flush();
      while ((headings.at(-1)?.level ?? 0) >= level) {
        headings.pop();
      }
      headings.push({ level, text: title });
      continue;
    }
    if (/^(?:[-*+] |\d+[.)] )/.test(line)) {
      flush();
    }
    if (block.length === 0) {
      if (!line.trim()) {
        continue;
      }
      startLine = lineIndex + 1;
    }
    block.push(line);
    fence = delimiter;
  }
  flush();
  return rules;
}

export function resolvePreferenceRules(options: {
  readonly sources: readonly ContextFile[];
  readonly selectedPaths: readonly string[];
}): readonly PreferenceCheck[] {
  const sources = new Map(
    options.sources.map((source) => [source.relativePath, source]),
  );
  const rules = new Map<string, PreferenceCheck>();
  for (const relativePath of options.selectedPaths) {
    const source = sources.get(relativePath);
    if (!source) {
      throw new Error("Preparation selected an unknown preference source");
    }
    for (const rule of sourceRules(source)) {
      const key = rule.requirement.replace(/\s+/g, " ");
      if (!rules.has(key)) {
        rules.set(key, rule);
      }
    }
  }
  return [...rules.values()];
}
