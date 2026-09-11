import path from "node:path";
import { materializeSnapshot } from "../../redact";
import { maximumProfileBytes } from "../../io/limits";
import type { OriginScope } from "../../signal";
import { splitProfileBlocks } from "../blocks";
import { parseProfileBlocks } from "../parse";
import { isSafeProfileSegment } from "../render";
import type { ExistingProfileBlock, ProfileRule } from "../types";
import { profileBlockMetadata, stripProfileMetadata } from "../visible";
import type { CompilerBlock } from "./types";

const scopeFilenames = [
  "identity.md",
  "engineering.md",
  "workflow.md",
  "boundaries.md",
] as const;

export function profileScopePaths(options: {
  readonly origin: OriginScope;
  readonly targetRepo: string | null;
}): readonly string[] {
  const globalPaths = scopeFilenames.map((filename) =>
    path.join("global", filename),
  );
  if (!isSafeProfileSegment(options.origin.directoryName)) {
    return globalPaths;
  }
  const organization = path.join("org", options.origin.directoryName);
  const organizationPaths = scopeFilenames.map((filename) =>
    path.join(organization, filename),
  );
  const targetRepo = options.targetRepo;
  if (targetRepo === null || !isSafeProfileSegment(targetRepo)) {
    return [...globalPaths, ...organizationPaths];
  }
  return [
    ...globalPaths,
    ...organizationPaths,
    path.join(organization, "projects", `${targetRepo}.md`),
  ];
}

function compilerBlock(options: {
  readonly block: ExistingProfileBlock;
  readonly redactedBlock: string;
}): CompilerBlock {
  const visible = stripProfileMetadata(options.redactedBlock);
  if (options.block.key === null) {
    return {
      ruleKey: null,
      source: "user",
      status: "active",
      observations: 0,
      visible,
      appliesWhen: [],
    };
  }
  return {
    ruleKey: options.block.key,
    source: options.block.source,
    status: options.block.status,
    observations: options.block.observations,
    visible,
    appliesWhen: profileBlockMetadata(options.redactedBlock).appliesWhen,
  };
}

async function readScopeFile(options: {
  readonly filePath: string;
  readonly profileDirectory: string;
}): Promise<readonly CompilerBlock[]> {
  const snapshot = await materializeSnapshot({
    filePath: options.filePath,
    roots: [options.profileDirectory],
    maximumBytes: maximumProfileBytes,
    parse: parseProfileBlocks,
  });
  if (snapshot === null) {
    return [];
  }
  const rawBlocks = snapshot.parsed;
  const redactedBlocks = splitProfileBlocks(snapshot.redacted);
  if (rawBlocks.length !== redactedBlocks.length) {
    return [];
  }
  return rawBlocks.flatMap((block, index) => {
    const redactedBlock = redactedBlocks[index];
    return redactedBlock === undefined
      ? []
      : [compilerBlock({ block, redactedBlock })];
  });
}

export async function readCompilerBlocks(options: {
  readonly profileDirectory: string;
  readonly origin: OriginScope;
  readonly targetRepo: string | null;
}): Promise<readonly CompilerBlock[]> {
  const files = await Promise.all(
    profileScopePaths({
      origin: options.origin,
      targetRepo: options.targetRepo,
    }).map((relativePath) =>
      readScopeFile({
        filePath: path.join(options.profileDirectory, relativePath),
        profileDirectory: options.profileDirectory,
      }),
    ),
  );
  return files.flat();
}

export function compilerBlocksFromRules(
  rules: readonly ProfileRule[],
): readonly CompilerBlock[] {
  return rules.map((rule) => ({
    ruleKey: rule.key,
    source: rule.source,
    status: rule.status,
    observations: rule.observations,
    visible:
      rule.body.length === 0
        ? `## ${rule.title}`
        : `## ${rule.title}\n\n${rule.body}`,
    appliesWhen: rule.appliesWhen,
  }));
}
