import { maximumProfileBytes } from "../io/limits";
import path from "node:path";
import type { ProjectPaths } from "../paths";
import { materializeSnapshot } from "../redact";
import { splitProfileBlocks } from "./blocks";
import { parseProfileBlocks } from "./parse";
import {
  parseProfileRejectionText,
  type ProfileRejection,
} from "./state";
import type { ExistingProfileRule, ProfileRule, ProfileSection } from "./types";
import { profileBlockMetadata, profileVisibleParts } from "./visible";

export type ProfileSnapshotRule = {
  readonly rule: ProfileRule;
  readonly promptTitle: string;
  readonly promptBody: string;
  readonly promptAppliesWhen: readonly string[];
  readonly promptProposal: ProfileRule["proposal"];
};

export type ProfileSnapshotRejection = {
  readonly rejection: ProfileRejection;
  readonly promptTitle: string | null;
  readonly promptBody: string | null;
};

export type ProfileSnapshot = {
  readonly rules: readonly ProfileSnapshotRule[];
  readonly rejections: readonly ProfileSnapshotRejection[];
};

function profileSection(value: string): ProfileSection | null {
  if (value === "engineering" || value === "workflow" || value === "boundaries") {
    return value;
  }
  return null;
}

function locatedRule(options: {
  readonly existing: ExistingProfileRule;
  readonly relativePath: string;
}): ProfileRule | null {
  const segments = options.relativePath.split("/");
  const filename = segments.at(-1) ?? "";
  const sectionName = filename.replace(/\.md$/, "");
  const section = profileSection(sectionName);
  const fields = { ...options.existing, section: "engineering" as const };
  if (segments[0] === "global" && segments.length === 2 && section !== null) {
    return { ...fields, section, scope: "global", originDirectory: null, repositoryName: null };
  }
  const originDirectory = segments[1];
  if (!originDirectory || segments[0] !== "org") {
    return null;
  }
  if (segments.length === 3 && section !== null) {
    return { ...fields, section, scope: "org", originDirectory, repositoryName: null };
  }
  if (segments.length === 4 && segments[2] === "projects" && filename.endsWith(".md")) {
    return { ...fields, scope: "project", originDirectory, repositoryName: sectionName };
  }
  return null;
}

async function profileFiles(profileDirectory: string): Promise<readonly string[]> {
  try {
    return (
      await Array.fromAsync(
        new Bun.Glob("{global,org}/**/*.md").scan({
          cwd: profileDirectory,
          onlyFiles: true,
        }),
      )
    ).sort();
  } catch {
    return [];
  }
}

async function readRules(options: {
  readonly profileDirectory: string;
  readonly relativePath: string;
}): Promise<readonly ProfileSnapshotRule[]> {
  const filePath = path.join(options.profileDirectory, options.relativePath);
  const snapshot = await materializeSnapshot({
    filePath,
    roots: [options.profileDirectory],
    maximumBytes: maximumProfileBytes,
    parse: parseProfileBlocks,
  });
  if (snapshot === null) {
    return [];
  }
  const rawBlocks = snapshot.parsed;
  const promptBlocks = splitProfileBlocks(snapshot.redacted);
  return rawBlocks.flatMap((block, index) => {
    if (block.key === null) {
      return [];
    }
    const rule = locatedRule({ existing: block, relativePath: options.relativePath });
    const promptBlock = promptBlocks[index];
    if (!rule) {
      throw new Error("Profile rule is outside the reconciliation path shape");
    }
    if (!promptBlock) {
      return [];
    }
    const prompt = profileVisibleParts(promptBlock);
    const metadata = profileBlockMetadata(promptBlock);
    return [{
      rule,
      promptTitle: prompt.title,
      promptBody: prompt.body,
      promptAppliesWhen: metadata.appliesWhen,
      promptProposal: metadata.proposal,
    }];
  });
}

async function readRejections(paths: ProjectPaths): Promise<readonly ProfileSnapshotRejection[]> {
  const snapshot = await materializeSnapshot({
    filePath: paths.rejectedProfileFile,
    roots: [paths.profileDirectory],
    maximumBytes: maximumProfileBytes,
    parse: parseProfileRejectionText,
  });
  if (snapshot === null) {
    return [];
  }
  const raw = snapshot.parsed;
  const prompt = parseProfileRejectionText(snapshot.redacted);
  return raw.flatMap((rejection, index) => {
    const redacted = prompt[index];
    return redacted
      ? [{ rejection, promptTitle: redacted.title, promptBody: redacted.body }]
      : [];
  });
}

export async function readProfileSnapshot(paths: ProjectPaths): Promise<ProfileSnapshot> {
  const relativePaths = await profileFiles(paths.profileDirectory);
  const rules = (await Promise.all(
    relativePaths.map((relativePath) =>
      readRules({ profileDirectory: paths.profileDirectory, relativePath }),
    ),
  )).flat();
  return { rules, rejections: await readRejections(paths) };
}
