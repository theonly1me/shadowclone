import { commitLocalChanges, type FileUpdate } from "../changes";
import path from "node:path";
import { acquireLocalLock } from "../localFiles/lock";
import { readLocalText } from "../localFiles";
import type { ProjectPaths } from "../paths";
import { ownedDirectory, ownedFile } from "../storage";
import {
  generatedProfileEntry,
  prepareProfileWrite,
} from "./lifecycle";
import { migratedLegacyRule } from "./migrate";
import { metadataReplacement } from "./metadataReplacement";
import { assertProfileRetention } from "./retention";
import { profileRulePath, renderProfileRule } from "./render";
import type { GeneratedProfileStateEntry } from "./state";
import {
  renderGeneratedProfileState,
  renderProfileRejections,
} from "./stateRender";
import type {
  ProfileRule,
  ProfileRuleReference,
  ProfileWriteResult,
} from "./types";

type WriteOptions = {
  readonly paths: ProjectPaths;
  readonly rules: readonly ProfileRule[];
  readonly retired?: readonly ProfileRuleReference[];
};

export async function writeProfile(options: WriteOptions): Promise<ProfileWriteResult> {
  await ownedDirectory(options.paths.profileDirectory);
  const lock = await acquireLocalLock(path.join(options.paths.shadowcloneDirectory, "profile-write.db"));
  if (!lock) throw new Error("Another profile update is running; retry shortly");
  try { return await writeProfileRevision(options); }
  finally { lock.release(); }
}

async function writeProfileRevision(options: WriteOptions): Promise<ProfileWriteResult> {
  const updates: FileUpdate[] = [];
  const previousManifest = await readLocalText(options.paths.profileManifestFile);
  const previousRejections = await readLocalText(options.paths.rejectedProfileFile);
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
      if (prepared.retired.has(block.key)) {
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
      const migrated = migratedLegacyRule({
        block,
        relativePath: file.relativePath,
      });
      const carried = migrated ?? block;
      nextBlocks.push(migrated ? renderProfileRule(migrated) : block.content);
      consumed.add(block.key);
      nextState.set(
        block.key,
        generatedProfileEntry({
          relativePath: file.relativePath,
          rule: carried,
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
      updates.push({ filePath: file.filePath, next: `${nextBlocks.join("\n\n")}\n`, previous: file.content });
      writtenFiles += 1;
      ruleCount += nextBlocks.length;
    } else if (file.blocks.length > 0) {
      updates.push({ filePath: file.filePath, next: null, previous: file.content });
    }
  }

  assertProfileRetention({
    files: prepared.files,
    written: new Set([...consumed, ...prepared.pinned]),
    retired: new Set(prepared.retired.keys()),
  });

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
  updates.push({ filePath: options.paths.profileManifestFile, next: renderGeneratedProfileState([...nextState.values()]), previous: previousManifest });
  updates.push({ filePath: options.paths.rejectedProfileFile, next: renderProfileRejections([...prepared.rejections.values()]), previous: previousRejections });
  for (const update of updates.filter((update) => update.next !== null)) {
    await ownedDirectory(path.dirname(update.filePath));
    await ownedFile(update.filePath);
  }
  await commitLocalChanges({ paths: options.paths, root: options.paths.profileDirectory, kind: "profile", updates });
  return {
    files: writtenFiles,
    rules: ruleCount,
    rejected: prepared.rejections.size,
    preserved: prepared.incomingRules.filter((rule) =>
      prepared.pinned.has(rule.key)
    ).length,
  };
}
