import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { ProjectPaths } from "../paths";
import { parseProfileBlocks } from "./parse";
import {
  profileRulePath,
  renderProfileRule,
} from "./render";
import {
  readProfileState,
  renderProfileState,
} from "./state";
import type { ProfileStateEntry } from "./state";
import type {
  ExistingProfileBlock,
  ProfileRule,
  ProfileWriteResult,
} from "./types";

function groupRules(
  rules: readonly ProfileRule[],
): ReadonlyMap<string, readonly ProfileRule[]> {
  return Map.groupBy(rules, profileRulePath);
}

async function readExistingRules(
  filePath: string,
): Promise<readonly ExistingProfileBlock[]> {
  const file = Bun.file(filePath);
  return (await file.exists()) ? parseProfileBlocks(await file.text()) : [];
}

function keyFor(entry: ProfileStateEntry): string {
  return `${entry.relativePath}\t${entry.key}`;
}

export async function writeProfile(options: {
  readonly paths: ProjectPaths;
  readonly rules: readonly ProfileRule[];
}): Promise<ProfileWriteResult> {
  await mkdir(options.paths.profileDirectory, { recursive: true });
  const previous = await readProfileState(options.paths.profileManifestFile);
  const rejectedEntries = await readProfileState(
    options.paths.rejectedProfileFile,
  );
  const rejected = new Map(
    rejectedEntries.map((entry) => [keyFor(entry), entry]),
  );
  const incoming = groupRules(options.rules);
  const previousPaths = previous.map((entry) => entry.relativePath);
  const relativePaths = new Set([...incoming.keys(), ...previousPaths]);
  const nextState: ProfileStateEntry[] = [];
  let files = 0;
  let ruleCount = 0;

  for (const relativePath of relativePaths) {
    const filePath = path.join(options.paths.profileDirectory, relativePath);
    const existingRules = await readExistingRules(filePath);
    const existing = new Map(
      existingRules.flatMap((rule) =>
        rule.key === null ? [] : [[rule.key, rule] as const]
      ),
    );
    const incomingRules = incoming.get(relativePath) ?? [];
    const nextBlocks: string[] = [];

    for (const entry of previous.filter(
      (value) => value.relativePath === relativePath,
    )) {
      if (
        incomingRules.some((rule) => rule.key === entry.key) &&
        !existing.has(entry.key)
      ) {
        rejected.set(keyFor(entry), entry);
      }
    }

    for (const existingRule of existingRules) {
      if (existingRule.key === null) {
        nextBlocks.push(existingRule.content);
        continue;
      }
      const updated = incomingRules.find(
        (rule) => rule.key === existingRule.key,
      );
      nextBlocks.push(
        updated && !existingRule.edited
          ? renderProfileRule(updated)
          : existingRule.content,
      );
      nextState.push({ relativePath, key: existingRule.key });
    }

    for (const rule of incomingRules) {
      const entry = { relativePath, key: rule.key };
      if (!existing.has(rule.key) && !rejected.has(keyFor(entry))) {
        nextBlocks.push(renderProfileRule(rule));
        nextState.push(entry);
      }
    }

    if (nextBlocks.length > 0) {
      await mkdir(path.dirname(filePath), { recursive: true });
      await Bun.write(filePath, `${nextBlocks.join("\n\n")}\n`);
      files += 1;
      ruleCount += nextBlocks.length;
    }
  }

  await Bun.write(
    options.paths.profileManifestFile,
    renderProfileState(nextState),
  );
  await Bun.write(
    options.paths.rejectedProfileFile,
    renderProfileState([...rejected.values()]),
  );
  return { files, rules: ruleCount, rejected: rejected.size };
}
