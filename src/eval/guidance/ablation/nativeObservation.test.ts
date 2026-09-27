import { expect, test } from "bun:test";
import { mkdtemp, realpath, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { nativeDeliveryObservation } from "./nativeObservation";
import { syntheticNativePacket } from "./nativePacket";

test("native observations distinguish complete, absent, duplicate, and partial packets", async () => {
  const directory = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "native-observation-")),
  );
  const packet = syntheticNativePacket(4096);
  const observe = (body: unknown) =>
    nativeDeliveryObservation({ body, packet, forbidden: "canary", directory });

  try {
    const complete = await observe({
      messages: [{ content: [{ text: `prefix ${packet}` }] }],
    });

    expect(complete.classification).toBe("inline-complete");
    expect(complete.positions).toEqual([
      {
        location: "$.messages[0].content[0].text",
        characters: 4103,
        bytes: 4103,
        startOffset: 7,
        prefixCharacters: 4096,
      },
    ]);
    expect((await observe("nothing supplied")).classification).toBe("omitted");
    expect((await observe([packet, packet])).classification).toBe("duplicate");
    expect((await observe(packet.slice(0, 2000))).classification).toBe(
      "truncated",
    );
    expect(
      (await observe(packet.replace("Synthetic", "Changed"))).completeOnce,
    ).toBe(false);
    expect((await observe([packet, "canary"])).forbiddenCopies).toBe(1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a preview with a complete fixture file is not complete inline delivery", async () => {
  const directory = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "native-preview-")),
  );
  const packet = syntheticNativePacket(16255);

  try {
    await Bun.write(path.join(directory, "packet.txt"), packet);

    const proof = await nativeDeliveryObservation({
      body: `${directory}/packet.txt\n${packet.slice(0, 2000)}`,
      packet,
      forbidden: "canary",
      directory,
    });

    expect(proof.classification).toBe("preview-file-substitution");
    expect(proof.completeOnce).toBe(false);
    expect(proof.files).toEqual([
      {
        relativePath: "packet.txt",
        bytes: 16255,
        fingerprint: new Bun.CryptoHasher("sha256")
          .update(packet)
          .digest("hex"),
        complete: true,
      },
    ]);
    expect(JSON.stringify(proof)).not.toContain("Synthetic guidance");

    await Bun.write(path.join(directory, "packet.txt"), `${packet}\nChanged`);

    const changed = await nativeDeliveryObservation({
      body: `${directory}/packet.txt\n${packet.slice(0, 2000)}`,
      packet,
      forbidden: "canary",
      directory,
    });

    expect(changed.classification).toBe("truncated");
    expect(changed.files[0]?.complete).toBe(false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("packet pointers outside the fixture and symlink escapes are excluded", async () => {
  const directory = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "native-confined-")),
  );
  const outside = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "native-outside-")),
  );
  const packet = syntheticNativePacket(4096);

  try {
    const target = path.join(outside, "packet.txt");

    await Bun.write(target, packet);
    await symlink(target, path.join(directory, "escape.txt"));

    const proof = await nativeDeliveryObservation({
      body: `${target}\n${directory}/escape.txt\n${packet.slice(0, 2000)}`,
      packet,
      forbidden: "canary",
      directory,
    });

    expect(proof.files).toEqual([]);
    expect(proof.classification).toBe("truncated");
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("multibyte lengths and markers are measured without confusing bytes and characters", async () => {
  const directory = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "native-unicode-")),
  );
  const packet = syntheticNativePacket(9000).replace(/[a-z]/g, "é");

  try {
    const proof = await nativeDeliveryObservation({
      body: packet,
      packet,
      forbidden: "canary",
      directory,
    });

    expect(packet.length).toBe(9000);
    expect(Buffer.byteLength(packet)).toBeGreaterThan(10000);
    expect(proof.completeOnce).toBe(true);
    expect(proof.positions[0]?.prefixCharacters).toBe(9000);
    expect(proof.positions[0]?.bytes).toBe(Buffer.byteLength(packet));
    expect(syntheticNativePacket(10000).length).toBe(10000);
    expect(syntheticNativePacket(10001).length).toBe(10001);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
