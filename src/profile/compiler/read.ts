import path from "node:path";
import { resolveRedacted } from "../../redact";
import type { OriginScope } from "../../signal";
import { splitProfileBlocks } from "../blocks";
import { parseProfileBlocks } from "../parse";
import { isSafeProfileSegment } from "../render";
import type { ExistingProfileBlock, ProfileRule } from "../types";
import {
  profileBlockMetadata,
  stripProfileMetadata,
} from "../visible";
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

async function readScopeFile(
  filePath: string,
): Promise<readonly CompilerBlock[]> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    return [];
  }
  const rawBlocks = parseProfileBlocks(await file.text());
  const redactedBlocks = splitProfileBlocks(
    await resolveRedacted({
      ref: {
        type: "file",
        sourcePath: filePath,
        byteOffset: 0,
        byteLength: file.size,
      },
    }),
  );
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
      readScopeFile(path.join(options.profileDirectory, relativePath)),
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
