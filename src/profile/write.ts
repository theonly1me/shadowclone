import { rm } from "node:fs/promises";
import type { ProjectPaths } from "../paths";
import { ownedDirectory, ownedWrite } from "../storage";
import {
  generatedProfileEntry,
  prepareProfileWrite,
} from "./lifecycle";
import { profileRulePath, renderProfileRule } from "./render";
import type { GeneratedProfileStateEntry } from "./state";
import {
  renderGeneratedProfileState,
  renderProfileRejections,
} from "./stateRender";
import type {
  ExistingProfileRule,
  ProfileRule,
  ProfileRuleReference,
  ProfileWriteResult,
} from "./types";

function metadataReplacement(options: {
  readonly block: ExistingProfileRule;
  readonly incoming: ProfileRule | undefined;
  readonly relativePath: string;
}): ProfileRule | null {
  const incoming = options.incoming;
  if (
    incoming?.source !== "user" ||
    incoming.title !== options.block.title ||
    incoming.body !== options.block.body ||
    profileRulePath(incoming) !== options.relativePath
  ) {
    return null;
  }
  return incoming;
}

export async function writeProfile(options: {
  readonly paths: ProjectPaths;
  readonly rules: readonly ProfileRule[];
  readonly retired?: readonly ProfileRuleReference[];
}): Promise<ProfileWriteResult> {
  await ownedDirectory(options.paths.profileDirectory);
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
      if (block.key === null) {
        nextBlocks.push(block.content);
        continue;
      }
      const metadataUpdate = metadataReplacement({
        block,
        incoming: prepared.incoming.get(block.key),
        relativePath: file.relativePath,
      });
      if (metadataUpdate) {
        nextBlocks.push(renderProfileRule(metadataUpdate));
        consumed.add(block.key);
        if (metadataUpdate.importReference !== null) {
          nextState.set(
            block.key,
            generatedProfileEntry({
              relativePath: file.relativePath,
              rule: metadataUpdate,
            }),
          );
        }
        continue;
      }
      if (block.edited || block.source === "user") {
        nextBlocks.push(block.content);
        if (block.importReference !== null) {
          nextState.set(
            block.key,
            generatedProfileEntry({
              relativePath: file.relativePath,
              rule: block,
            }),
          );
        }
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
      await ownedWrite({
        path: file.filePath,
        content: `${nextBlocks.join("\n\n")}\n`,
      });
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
  await ownedWrite({
    path: options.paths.profileManifestFile,
    content: renderGeneratedProfileState([...nextState.values()]),
  });
  await ownedWrite({
    path: options.paths.rejectedProfileFile,
    content: renderProfileRejections([...prepared.rejections.values()]),
  });
  return {
    files: writtenFiles,
    rules: ruleCount,
    rejected: prepared.rejections.size,
    preserved: prepared.incomingRules.filter((rule) =>
      prepared.pinned.has(rule.key)
    ).length,
  };
}
