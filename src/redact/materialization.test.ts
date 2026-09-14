import { expect, test } from "bun:test";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { materializeSnapshot, resolveRedacted } from "./index";

test("a stored pointer cannot grant access outside the authorized root", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "shadowclone-root-"));
  const outside = await mkdtemp(path.join(os.tmpdir(), "shadowclone-outside-"));
  try {
    const filePath = path.join(outside, "secret");
    await writeFile(filePath, "secret");
    await symlink(outside, path.join(root, "escape"));
    for (const sourcePath of [filePath, path.join(root, "escape", "secret")]) {
      expect(
        await resolveRedacted({
          ref: { type: "file", sourcePath, byteOffset: 0, byteLength: 6 },
          roots: [root],
        }),
      ).toBe("");
    }
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("invalid and oversized ranges produce no materialized text", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "shadowclone-range-"));
  try {
    const sourcePath = path.join(root, "text");
    await writeFile(sourcePath, "bounded");
    for (const byteOffset of [-1, 0.5, Number.NaN, Number.MAX_SAFE_INTEGER]) {
      expect(
        await resolveRedacted({
          ref: { type: "file", sourcePath, byteOffset, byteLength: 2 },
          roots: [root],
        }),
      ).toBe("");
    }
    expect(
      await resolveRedacted({
        ref: {
          type: "file",
          sourcePath,
          byteOffset: 0,
          byteLength: 9 * 1024 * 1024,
        },
        roots: [root],
      }),
    ).toBe("");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("metadata and redaction use one snapshot even if the file changes after parsing", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "shadowclone-snapshot-"));
  try {
    const filePath = path.join(root, "profile.md");
    await writeFile(filePath, "original sk-proj-abcdefghijklmnopqrstuv");
    const snapshot = await materializeSnapshot({
      filePath,
      roots: [root],
      maximumBytes: 1024,
      parse: (text) => {
        writeFileSync(filePath, "replacement");
        return text.startsWith("original");
      },
    });
    expect(snapshot?.parsed).toBeTrue();
    expect(snapshot?.redacted).toStartWith("original");
    expect(snapshot?.redacted).not.toContain("abcdefghijklmnopqrstuv");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a captured pointer rejects replacement bytes at the same offset", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "shadowclone-identity-"));
  try {
    const sourcePath = path.join(root, "record");
    const original = '{"text":"original"}';
    await writeFile(sourcePath, original);
    const ref = {
      type: "file" as const,
      sourcePath,
      byteOffset: 0,
      byteLength: Buffer.byteLength(original),
      contentHash: new Bun.CryptoHasher("sha256")
        .update(original)
        .digest("hex"),
    };
    expect(await resolveRedacted({ ref, roots: [root] })).toBe(original);
    await writeFile(sourcePath, '{"text":"replaced"}');
    expect(await resolveRedacted({ ref, roots: [root] })).toBe("");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
