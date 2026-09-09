import path from "node:path";
import type { ProjectPaths } from "../paths";
import { resolveRedacted } from "../redact";
import { splitProfileBlocks } from "./blocks";
import { profileMetadataSchema } from "./metadata";
import { parseProfileBlocks } from "./parse";
import {
  parseProfileRejectionText,
  type ProfileRejection,
} from "./state";
import type { ExistingProfileRule, ProfileRule, ProfileSection } from "./types";

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

function visibleParts(block: string): {
  readonly title: string;
  readonly body: string;
} {
  const visible = block.replace(/\n\n<!-- shadowclone: [^\n]+ -->\s*$/, "").trim();
  const [heading, ...body] = visible.split("\n");
  return {
    title: heading?.replace(/^#+\s*/, "").trim() ?? "",
    body: body.join("\n").trim(),
  };
}

function promptMetadata(block: string): {
  readonly appliesWhen: readonly string[];
  readonly proposal: ProfileRule["proposal"];
} {
  const match = block.match(/\n\n<!-- shadowclone: ([^\n]+) -->\s*$/);
  if (!match?.[1]) {
    return { appliesWhen: [], proposal: null };
  }
  let value: unknown;
  try {
    value = JSON.parse(match[1]);
  } catch {
    return { appliesWhen: [], proposal: null };
  }
  const parsed = profileMetadataSchema.safeParse(value);
  return parsed.success
    ? {
        appliesWhen: parsed.data["applies-when"],
        proposal: parsed.data.proposal,
      }
    : { appliesWhen: [], proposal: null };
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
  const file = Bun.file(filePath);
  const rawText = await file.text();
  const promptText = await resolveRedacted({
    ref: { type: "file", sourcePath: filePath, byteOffset: 0, byteLength: file.size },
  });
  const rawBlocks = parseProfileBlocks(rawText);
  const promptBlocks = splitProfileBlocks(promptText);
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
    const prompt = visibleParts(promptBlock);
    const metadata = promptMetadata(promptBlock);
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
  const file = Bun.file(paths.rejectedProfileFile);
  if (!(await file.exists())) {
    return [];
  }
  const raw = parseProfileRejectionText(await file.text());
  const prompt = parseProfileRejectionText(
    await resolveRedacted({
      ref: { type: "file", sourcePath: paths.rejectedProfileFile, byteOffset: 0, byteLength: file.size },
    }),
  );
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
