import { expect, test } from "bun:test";
import { nativePacketObservation, syntheticNativePacket } from "./nativePacket";

test("native packet proof requires one complete copy, not a preview or duplicates", () => {
  const packet = syntheticNativePacket(16255);

  expect(Buffer.byteLength(packet)).toBe(16255);

  const complete = {
    messages: [
      { content: [{ type: "text", text: `Prefix\n${packet}\nSuffix` }] },
    ],
  };

  expect(
    nativePacketObservation({ body: complete, packet, forbidden: "unselected" })
      .completeOnce,
  ).toBe(true);

  const preview = { system: [{ text: packet.slice(0, 2000) }] };

  expect(
    nativePacketObservation({ body: preview, packet, forbidden: "unselected" })
      .completeOnce,
  ).toBe(false);
  expect(
    nativePacketObservation({
      body: [packet, packet],
      packet,
      forbidden: "unselected",
    }).completeOnce,
  ).toBe(false);
  expect(
    nativePacketObservation({
      body: "unselected",
      packet,
      forbidden: "unselected",
    }).forbiddenCopies,
  ).toBe(1);
});
