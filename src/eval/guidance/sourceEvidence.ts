import path from "node:path";
import { stat } from "node:fs/promises";
import { canonicalPath } from "../../paths";
import { fingerprint } from "../transfer/structured";
import { captureJudgePacket } from "./judgeEvidence";
import { sourceJudgePromptFingerprint } from "./judgePrompt";
import {
  sourceJudgingSchema,
  type SourceJudging,
  type SourcePacket,
} from "./sourceEvidenceSchema";
import type { GuidanceSuite } from "./schema";
import {
  historicalSources,
  checkedLocations,
  validateSourcePacket,
} from "./sourceValidation";

export {
  historicalSources,
  checkedLocations,
  validateSourcePacket,
  validateSourceJudging,
} from "./sourceValidation";

export async function captureSourceJudging(options: {
  readonly directory: string;
  readonly suite: GuidanceSuite;
}): Promise<SourceJudging> {
  const repository = await captureJudgePacket({
    directory: options.directory,
    commit: options.suite.baseCommit,
  });

  const documents: SourcePacket["documents"] = repository.files.map(
    (file, index) => ({
      id: `source-${index + 1}`,
      contentHash: file.contentHash,
      numberedContent: file.numberedContent,
    }),
  );

  const provenance = repository.files.map((file, index) => ({
    id: `source-${index + 1}`,
    path: file.path,
    sourceHash: file.contentHash,
  }));

  for (const sourcePath of historicalSources) {
    const file = options.suite.memory.find(
      (entry) => entry.relativePath === sourcePath,
    );

    if (!file?.content.trim()) {
      throw new Error("Complete historical judge source is missing");
    }

    const content = file.content.replace(/^---\n[\s\S]*?\n---\n*/, "");
    const id = `source-${documents.length + 1}`;

    documents.push({
      id,
      contentHash: fingerprint(content),
      numberedContent: content
        .split("\n")
        .map((line, index) => `${index + 1}: ${line}`)
        .join("\n"),
    });
    provenance.push({
      id,
      path: sourcePath,
      sourceHash: fingerprint(file.content),
    });
  }

  const locations = [];

  for (const relativePath of checkedLocations) {
    const absolute = path.join(options.directory, relativePath);

    if (
      !canonicalPath(absolute).startsWith(
        `${canonicalPath(options.directory)}${path.sep}`,
      )
    ) {
      throw new Error("Judge location escapes the snapshot");
    }

    const metadata = await stat(absolute).catch(() => null);

    locations.push({
      path: relativePath,
      exists: relativePath.endsWith(".ts")
        ? metadata?.isFile() === true
        : metadata?.isDirectory() === true,
    });
  }

  const packet = { commit: options.suite.baseCommit, documents, locations };

  validateSourcePacket(packet);

  return sourceJudgingSchema.parse({
    version: 4,
    promptFingerprint: sourceJudgePromptFingerprint(4),
    packetFingerprint: fingerprint(packet),
    packet,
    provenance,
  });
}
