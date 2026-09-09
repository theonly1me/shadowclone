import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import type { ProjectPaths } from "../paths";
import {
  generatedProfileEntry,
  prepareProfileWrite,
} from "./lifecycle";
import { profileRulePath, renderProfileRule } from "./render";
import {
  renderGeneratedProfileState,
  renderProfileRejections,
} from "./state";
import type { GeneratedProfileStateEntry } from "./state";
import type {
  ProfileRule,
  ProfileRuleReference,
  ProfileWriteResult,
} from "./types";

export async function writeProfile(options: {
  readonly paths: ProjectPaths;
  readonly rules: readonly ProfileRule[];
  readonly retired?: readonly ProfileRuleReference[];
}): Promise<ProfileWriteResult> {
  await mkdir(options.paths.profileDirectory, { recursive: true });
  const prepared = await prepareProfileWrite({
    paths: options.paths,
    rules: options.rules,
    retiredReferences: options.retired ?? [],
  });
  const nextState = new Map<string, GeneratedProfileStateEntry>();
  const consumed = new Set<string>();
  let writtenFiles = 0;
  let ruleCount = 0;

  for (const file of prepared.files) {
    const nextBlocks: string[] = [];
    for (const block of file.blocks) {
      if (block.key === null || block.edited || block.source === "user") {
        nextBlocks.push(block.content);
        continue;
      }
      if (block.legacy || prepared.retired.has(block.key)) {
        continue;
      }
      const replacement = prepared.incoming.get(block.key);
      if (replacement) {
        if (profileRulePath(replacement) !== file.relativePath) {
          continue;
        }
        nextBlocks.push(renderProfileRule(replacement));
        consumed.add(block.key);
        if (replacement.source !== "user") {
          nextState.set(
            block.key,
            generatedProfileEntry({
              relativePath: file.relativePath,
              rule: replacement,
            }),
          );
        }
        continue;
      }
      nextBlocks.push(block.content);
      nextState.set(
        block.key,
        generatedProfileEntry({
          relativePath: file.relativePath,
          rule: block,
        }),
      );
    }
    for (const rule of prepared.incomingRules) {
      if (
        profileRulePath(rule) !== file.relativePath ||
        consumed.has(rule.key) ||
        prepared.pinned.has(rule.key) ||
        prepared.retired.has(rule.key) ||
        prepared.rejections.has(rule.key)
      ) {
        continue;
      }
      nextBlocks.push(renderProfileRule(rule));
      consumed.add(rule.key);
      if (rule.source !== "user") {
        nextState.set(
          rule.key,
          generatedProfileEntry({
            relativePath: file.relativePath,
            rule,
          }),
        );
      }
    }
    if (nextBlocks.length > 0) {
      await mkdir(path.dirname(file.filePath), { recursive: true });
      await Bun.write(file.filePath, `${nextBlocks.join("\n\n")}\n`);
      writtenFiles += 1;
      ruleCount += nextBlocks.length;
    } else if (file.blocks.length > 0) {
      await rm(file.filePath, { force: true });
    }
  }

  for (const entry of prepared.previousEntries) {
    if (
      entry.disposition === "present" &&
      !prepared.incoming.has(entry.key) &&
      !prepared.pinned.has(entry.key) &&
      !prepared.retired.has(entry.key)
    ) {
      nextState.set(entry.key, entry);
    }
  }
  for (const entry of prepared.retired.values()) {
    nextState.set(entry.key, entry);
  }
  await Bun.write(
    options.paths.profileManifestFile,
    renderGeneratedProfileState([...nextState.values()]),
  );
  await Bun.write(
    options.paths.rejectedProfileFile,
    renderProfileRejections([...prepared.rejections.values()]),
  );
  return {
    files: writtenFiles,
    rules: ruleCount,
    rejected: prepared.rejections.size,
  };
}
