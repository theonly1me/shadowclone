import type { EngineRunner } from "../engine";
import {
  profileEvidenceStatistics,
  type ProfileEvidence,
  type ProfileRule,
} from "../profile";
import { mergeDistilledRules } from "./merge";

function unionEvidence(rules: readonly ProfileRule[]): ProfileEvidence {
  return {
    for: [...new Set(rules.flatMap((rule) => rule.evidence.for))],
    against: [...new Set(rules.flatMap((rule) => rule.evidence.against))],
  };
}

async function consolidateOrigin(options: {
  readonly rules: readonly ProfileRule[];
  readonly runner: EngineRunner;
  readonly workingDirectory: string;
  readonly checkpointDirectory?: string;
}): Promise<readonly ProfileRule[]> {
  if (options.rules.length <= 1) {
    return options.rules;
  }
  const merged = await mergeDistilledRules({
    rules: options.rules.map((rule) => ({
      title: rule.title,
      body: rule.body,
      section: rule.section,
    })),
    runner: options.runner,
    cwd: options.workingDirectory,
    checkpointDirectory: options.checkpointDirectory,
  });
  return merged.flatMap((result, resultIndex) => {
    const sourceIndices = result.sources ?? [resultIndex];
    const constituents = [
      ...new Set(sourceIndices),
    ].flatMap((index) => options.rules[index] ? [options.rules[index]] : []);
    const [first] = constituents;
    if (!first) {
      return [];
    }
    const evidence = unionEvidence(constituents);
    const combined: ProfileRule = {
      ...first,
      title: result.title,
      body: result.body,
      section: result.section,
      evidence,
    };
    const statistics = profileEvidenceStatistics({ rule: combined, evidence });
    return [{
      ...combined,
      ...statistics,
      status: statistics.sessions >= 3 ? "active" as const : "candidate" as const,
    }];
  });
}

export async function consolidateNewRules(options: {
  readonly rules: readonly ProfileRule[];
  readonly runner: EngineRunner;
  readonly workingDirectory: string;
  readonly checkpointDirectory?: string;
}): Promise<readonly ProfileRule[]> {
  const groups = Map.groupBy(options.rules, (rule) => rule.originDirectory);
  const consolidated: ProfileRule[] = [];
  for (const rules of groups.values()) {
    consolidated.push(...await consolidateOrigin({ ...options, rules }));
  }
  return consolidated;
}
