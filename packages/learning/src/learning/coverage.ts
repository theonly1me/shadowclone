import path from "node:path";
import { fingerprint, type ProjectPaths, type ShadowcloneConfig } from "@shadowclone/core";
import { globalInstructionFiles } from "@shadowclone/environment";
import { materializeSnapshot, redactSecrets } from "@shadowclone/redact";
import { discoverDeliverySkills, readMaintenanceState } from "@shadowclone/skills";
import type { CoveredGuidance } from "../distill";

const maximumInstructionBytes = 32_000;
const maximumSkillSummaries = 200;

async function readInstructionCoverage(homeDirectory: string): Promise<readonly CoveredGuidance[]> {
  const seen = new Set<string>();
  const coverage: CoveredGuidance[] = [];

  for (const relativePath of globalInstructionFiles) {
    const snapshot = await materializeSnapshot({
      filePath: path.join(homeDirectory, relativePath),
      roots: [homeDirectory],
      maximumBytes: maximumInstructionBytes,
      parse: () => null,
    });
    const text = snapshot?.redacted.trim() ?? "";

    if (text.length > 0 && !seen.has(fingerprint(text))) {
      seen.add(fingerprint(text));
      coverage.push({ source: `~/${relativePath}`, text });
    }
  }

  return coverage;
}

async function readSkillCoverage(paths: ProjectPaths): Promise<readonly CoveredGuidance[]> {
  const maintenance = await readMaintenanceState(paths);
  const discovered = await discoverDeliverySkills(maintenance.roots.filter((root) =>
    root.enabled && root.scope === "global" && root.owner === "user",
  ));
  const summaries = [...new Map(discovered.skills.map((skill) => [skill.name, skill])).values()]
    .slice(0, maximumSkillSummaries)
    .map((skill) => `- ${skill.name}: ${skill.description.replace(/\s+/gu, " ").trim()}`);

  return summaries.length === 0 ? [] : [{
    source: "personal skills",
    text: redactSecrets({ text: summaries.join("\n"), homeDirectory: path.dirname(paths.shadowcloneDirectory) }),
  }];
}

export async function readCoveredGuidance(options: {
  readonly paths: ProjectPaths;
  readonly config: ShadowcloneConfig;
}): Promise<readonly CoveredGuidance[]> {
  const homeDirectory = path.dirname(options.paths.shadowcloneDirectory);

  return [
    ...(options.config.sources["agent-context"] ? await readInstructionCoverage(homeDirectory) : []),
    ...(options.config.sources["skill-library"] ? await readSkillCoverage(options.paths) : []),
  ];
}
