import { fingerprint } from "../transfer/structured";
import type { JudgePacket } from "./judgeEvidence";
import { sourceJudgePromptFingerprint } from "./judgePrompt";
import type { SourceJudging, SourcePacket } from "./sourceEvidenceSchema";
import type { GuidanceSuite } from "./schema";

export const historicalSources = [
  "memory/reference_first_source.md",
  "memory/reference_second_source.md",
] as const;

export const checkedLocations = [
  "packages/example",
  "services/example",
  "packages/example/src/session.test.ts",
  "services/example/src/session.test.ts",
] as const;

export function validateSourcePacket(packet: SourcePacket): void {
  if (Buffer.byteLength(JSON.stringify(packet)) > 65536) {
    throw new Error("Judge source packet exceeds 64 KiB");
  }

  if (
    packet.documents.length !== 6 ||
    packet.documents.some(
      (document, index) => document.id !== `source-${index + 1}`,
    )
  ) {
    throw new Error("Judge source identifiers changed");
  }

  for (const document of packet.documents) {
    const content = document.numberedContent
      .split("\n")
      .map((line, index) => {
        const prefix = `${index + 1}: `;

        if (!line.startsWith(prefix)) {
          throw new Error("Judge source line numbering changed");
        }

        return line.slice(prefix.length);
      })
      .join("\n");

    if (!content.trim() || fingerprint(content) !== document.contentHash) {
      throw new Error("Judge source content hash changed");
    }
  }

  if (
    packet.locations.length !== 4 ||
    packet.locations.some(
      (location, index) =>
        location.path !== checkedLocations[index] ||
        location.exists !== (index % 2 === 1),
    )
  ) {
    throw new Error("Repository location evidence is incomplete or changed");
  }
}

export function validateSourceJudging(options: {
  readonly judging: SourceJudging;
  readonly suite: GuidanceSuite;
  readonly repository: JudgePacket;
}): void {
  const { judging, suite, repository } = options;

  validateSourcePacket(judging.packet);

  const expectedDocuments = repository.files.map((file, index) => ({
    id: `source-${index + 1}`,
    contentHash: file.contentHash,
    numberedContent: file.numberedContent,
  }));
  const expectedProvenance = repository.files.map((file, index) => ({
    id: `source-${index + 1}`,
    path: file.path,
    sourceHash: file.contentHash,
  }));

  for (const sourcePath of historicalSources) {
    const file = suite.memory.find(
      (entry) => entry.relativePath === sourcePath,
    );

    if (!file) {
      throw new Error("Historical source missing");
    }

    const content = file.content.replace(/^---\n[\s\S]*?\n---\n*/, "");
    const id = `source-${expectedDocuments.length + 1}`;

    expectedDocuments.push({
      id,
      contentHash: fingerprint(content),
      numberedContent: content
        .split("\n")
        .map((line, index) => `${index + 1}: ${line}`)
        .join("\n"),
    });
    expectedProvenance.push({
      id,
      path: sourcePath,
      sourceHash: fingerprint(file.content),
    });
  }

  if (
    judging.promptFingerprint !==
      sourceJudgePromptFingerprint(judging.version) ||
    judging.packetFingerprint !== fingerprint(judging.packet) ||
    judging.packet.commit !== suite.baseCommit ||
    fingerprint(expectedDocuments) !== fingerprint(judging.packet.documents) ||
    fingerprint(expectedProvenance) !== fingerprint(judging.provenance)
  ) {
    throw new Error("Judge source provenance or contract changed");
  }
}
