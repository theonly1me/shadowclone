import { realpath } from "node:fs/promises";
import path from "node:path";
import { nativePacketObservation } from "./nativePacket";

type LocatedText = { location: string; text: string };

function locatedText(options: { value: unknown; location: string }): readonly LocatedText[] {
  if (typeof options.value === "string") return [{ location: options.location, text: options.value }];
  if (Array.isArray(options.value)) return options.value.flatMap((value, index) => locatedText({ value, location: `${options.location}[${index}]` }));
  if (options.value !== null && typeof options.value === "object") return Object.entries(options.value).flatMap(([key, value]) => locatedText({ value, location: `${options.location}.${key}` }));
  return [];
}

export async function nativeDeliveryObservation(options: { body: unknown; packet: string; forbidden: string; directory: string }) {
  const basic = nativePacketObservation(options);
  const texts = locatedText({ value: options.body, location: "$" });
  const root = await realpath(options.directory);
  const files: { relativePath: string; bytes: number; fingerprint: string; complete: boolean }[] = [];
  for (const candidate of new Set(texts.flatMap(({ text }) => text.match(/\/[^\s"'`<>]+/g) ?? []))) {
    const absolute = path.resolve(candidate);
    if (!absolute.startsWith(`${root}${path.sep}`)) continue;
    let canonical: string;
    try { canonical = await realpath(absolute); } catch { continue; }
    if (!canonical.startsWith(`${root}${path.sep}`)) continue;
    const file = Bun.file(canonical);
    if (file.size > 65536 || file.size === 0) continue;
    let content: string;
    try { content = await file.text(); } catch { continue; }
    if (!content.includes("SHADOWCLONE_SYNTHETIC_PACKET_BEGIN")) continue;
    files.push({ relativePath: path.relative(root, canonical), bytes: Buffer.byteLength(content), fingerprint: new Bun.CryptoHasher("sha256").update(content).digest("hex"), complete: content === options.packet });
  }
  const positions = texts.filter(({ text }) => text.includes("SHADOWCLONE_SYNTHETIC_PACKET_")).map(({ location, text }) => {
    const start = text.indexOf("SHADOWCLONE_SYNTHETIC_PACKET_BEGIN");
    let prefixCharacters = 0;
    while (start >= 0 && prefixCharacters < options.packet.length && text[start + prefixCharacters] === options.packet[prefixCharacters]) prefixCharacters += 1;
    return { location, characters: text.length, bytes: Buffer.byteLength(text), startOffset: start, prefixCharacters };
  });
  const classification = basic.completeOnce ? "inline-complete" : basic.starts > 1 || basic.ends > 1 ? "duplicate"
    : files.some((file) => file.complete) ? "preview-file-substitution" : basic.starts === 0 && basic.ends === 0 ? "omitted" : "truncated";
  return { ...basic, classification, positions, files };
}
