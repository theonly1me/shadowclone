import { parseReference } from "../../../references/format";
import { normalized } from "../../../references/search";
import { isSkillRoutingInstruction } from "../../../profile/skillRouting";

type FrozenFile = { readonly relativePath: string; readonly content: string };

export type GuidanceSelectionItem = {
  readonly id: string;
  readonly kind: "profile" | "reference";
  readonly title: string;
  readonly applicability: readonly string[];
  readonly tags: readonly string[];
  readonly summary: string;
  readonly body: string;
  readonly block: string;
  readonly excluded: "skill-routing" | "skill-covered" | null;
};

export function frozenSelectionCorpus(options: {
  readonly profile: string;
  readonly references: readonly FrozenFile[];
  readonly skills: readonly FrozenFile[];
}): readonly GuidanceSelectionItem[] {
  const skillBodies = options.skills
    .filter((file) => file.relativePath.endsWith("/SKILL.md"))
    .map((file) => normalized(file.content));

  const excluded = (body: string) =>
    isSkillRoutingInstruction(body)
      ? ("skill-routing" as const)
      : body.length > 0 &&
          skillBodies.some((skill) => skill.includes(normalized(body)))
        ? ("skill-covered" as const)
        : null;

  const profile = options.profile.split(/^Reference `/m)[0] ?? "";

  const sections = profile
    .split(/^## /m)
    .slice(1)
    .map((section) => {
      const [title = "", ...lines] = section.trim().split("\n");
      const body = lines
        .filter((line) => !/^(Guidance source|Applies when):/.test(line))
        .join("\n")
        .trim();

      return {
        id: `profile/${normalized(title).replaceAll(" ", "-")}`,
        kind: "profile" as const,
        title,
        applicability: lines
          .filter((line) => line.startsWith("Applies when:"))
          .map((line) => line.slice("Applies when:".length).trim()),
        tags: [],
        summary: "",
        body,
        block: `## ${section.trim()}`,
        excluded: excluded(body),
      };
    });

  const references = options.references.map((file) => {
    const record = parseReference(file.content);

    if (
      !record ||
      !/^references\/[a-z0-9._/-]+\.md$/.test(file.relativePath) ||
      file.relativePath.split("/").some((part) => part === "." || part === "..")
    ) {
      throw new Error("Frozen selection reference is invalid");
    }

    return {
      id: `reference/${record.key}`,
      kind: "reference" as const,
      title: record.title,
      applicability: [],
      tags: record.tags,
      summary: record.summary,
      body: record.body,
      block: `## ${record.title}\n\n${record.summary}\n\nRead: .eval-context/${file.relativePath}`,
      excluded: excluded(record.body),
    };
  });

  return [...sections, ...references];
}
