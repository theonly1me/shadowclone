import type { ProfileSource } from "../types";
import type {
  CompilerBlock,
  ProfileCompilation,
  ProfileCompilationOmission,
} from "./types";

export const defaultProfileByteBudget = 16_384;

const profilePreamble = "# Shadowclone profile";

const sourceLabels: Readonly<Record<ProfileSource, string>> = {
  user: "written by the user",
  declared: "declared by the user",
  imported: "imported from repository guidance",
  mined: "observed in the user's sessions",
};

function renderBlock(block: CompilerBlock): string {
  const lines = [
    block.visible,
    "",
    `Guidance source: ${sourceLabels[block.source]}`,
  ];
  if (block.appliesWhen.length > 0) {
    lines.push(`Applies when: ${block.appliesWhen.join(", ")}`);
  }
  return lines.join("\n");
}

export function renderCompilation(options: {
  readonly blocks: readonly CompilerBlock[];
  readonly byteBudget: number;
}): ProfileCompilation {
  const omissions: ProfileCompilationOmission[] = [];
  const appliedRuleKeys: string[] = [];
  const rendered: string[] = [];
  let usedBytes = Buffer.byteLength(`${profilePreamble}\n`, "utf8");

  for (const block of options.blocks) {
    const text = renderBlock(block);
    const addedBytes = Buffer.byteLength(`\n${text}\n`, "utf8");
    if (usedBytes + addedBytes > options.byteBudget) {
      omissions.push({ ruleKey: block.ruleKey, reason: "budget" });
      continue;
    }
    usedBytes += addedBytes;
    rendered.push(text);
    if (block.ruleKey !== null) {
      appliedRuleKeys.push(block.ruleKey);
    }
  }

  return {
    markdown:
      rendered.length === 0
        ? `${profilePreamble}\n`
        : `${profilePreamble}\n\n${rendered.join("\n\n")}\n`,
    appliedRuleKeys,
    appliedRuleCount: rendered.length,
    omissions,
  };
}
