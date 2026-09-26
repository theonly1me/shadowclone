import path from "node:path";
import { z } from "zod";
import { materializeSnapshot } from "../../redact";
import { fingerprint } from "../transfer/structured";

export const judgeEvidencePaths = [
  "services/example/package.json", "workspace.json", "tools/WORKSPACE.md", "docs/guides/writing-tests.md",
] as const;
export const judgePacketSchema = z.strictObject({
  commit: z.string(),
  files: z.array(z.strictObject({ path: z.string(), contentHash: z.string(), numberedContent: z.string() })).length(4),
});
export type JudgePacket = z.infer<typeof judgePacketSchema>;
export const judgingSchema = z.strictObject({
  version: z.literal(2), promptFingerprint: z.string(), packetFingerprint: z.string(), packet: judgePacketSchema,
});

export async function captureJudgePacket(options: { directory: string; commit: string }): Promise<JudgePacket> {
  const files: JudgePacket["files"] = [];
  for (const relativePath of judgeEvidencePaths) {
    const materialized = await materializeSnapshot({ filePath: path.join(options.directory, relativePath), roots: [options.directory], maximumBytes: 65536, parse: () => null });
    if (!materialized?.redacted.trim()) throw new Error("Judge evidence file missing or exceeds the packet limit");
    const content = materialized.redacted;
    files.push({ path: relativePath, contentHash: fingerprint(content), numberedContent: content.split("\n").map((line, index) => `${index + 1}: ${line}`).join("\n") });
  }
  const packet = judgePacketSchema.parse({ commit: options.commit, files });
  validateJudgePacket(packet);
  return packet;
}

export function validateJudgePacket(packet: JudgePacket): void {
  if (Buffer.byteLength(JSON.stringify(packet)) > 65536) throw new Error("Judge evidence packet exceeds 64 KiB");
  if (packet.files.some((file, index) => file.path !== judgeEvidencePaths[index])) throw new Error("Judge evidence paths changed");
  for (const file of packet.files) {
    const lines = file.numberedContent.split("\n");
    const content = lines.map((line, index) => {
      const prefix = `${index + 1}: `;
      if (!line.startsWith(prefix)) throw new Error("Judge evidence line numbering changed");
      return line.slice(prefix.length);
    }).join("\n");
    if (!content.trim() || fingerprint(content) !== file.contentHash) throw new Error("Judge evidence content hash changed");
  }
}
