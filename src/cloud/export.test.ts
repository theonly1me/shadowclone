import { expect, test } from "bun:test";
import path from "node:path";
import { chmod, lstat, symlink } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { exportGuidance } from "./export";
import { decodeBundle, encodeBundle } from "./bundle";
import { restoreGuidance } from "./restore";
import { guidanceFixture } from "./fixtures";

const selection = ["shadowclone-work"];

test("an export preserves only selected skills and their redacted resources", async () => {
  const fixture = await guidanceFixture();
  const script = path.join(fixture.directory, "scripts", "check.sh");
  const secret = `sk-ant-api03-${"synthetic".repeat(12)}`;

  try {
    await Bun.write(script, `#!/bin/sh\nprintf '%s' '${secret}'\n`);
    await chmod(script, 0o700);

    const delivery = await exportGuidance({ ...fixture, skills: selection });
    const files = decodeBundle(delivery.encoded);
    const restored = path.join(fixture.root, "cloud-guidance");

    await restoreGuidance({ encoded: delivery.encoded, destination: restored });

    expect(delivery.skills).toEqual(selection);
    expect(files).toEqual([...delivery.files]);
    expect(files.some((file) => file.path.endsWith("scripts/check.sh"))).toBeTrue();
    expect(
      files.map((file) => Buffer.from(file.content, "base64").toString()).join("\n"),
    ).not.toContain(secret);
    expect(delivery.native).not.toContain(fixture.root);
    expect(delivery.native).not.toContain("aggregated profile");
    expect(
      (
        await lstat(
          path.join(
            restored,
            "plugins/shadowclone-personal/skills/shadowclone-work/scripts/check.sh",
          ),
        )
      ).mode & 0o777,
    ).toBe(0o700);
  } finally {
    await fixture.cleanup();
  }
});

test("a missing selection, identifying path, or symlink prevents export", async () => {
  const fixture = await guidanceFixture();

  try {
    await expect(exportGuidance({ ...fixture, skills: [] })).rejects.toThrow("shadowclone-work");
    await expect(
      exportGuidance({ ...fixture, skills: [...selection, "not-installed"] }),
    ).rejects.toThrow("not available");
    await Bun.write(
      path.join(fixture.directory, "reference.md"),
      "Read C:\\synthetic\\private-notes.md.",
    );
    await expect(exportGuidance({ ...fixture, skills: selection })).rejects.toThrow(
      "identifying local paths",
    );
    await Bun.write(path.join(fixture.directory, "reference.md"), "Read the repository guide.");
    await symlink(fixture.filePath, path.join(fixture.directory, "linked.md"));
    await expect(exportGuidance({ ...fixture, skills: selection })).rejects.toThrow(
      "symbolic links",
    );
  } finally {
    await fixture.cleanup();
  }
});

test("secret size limits and traversal are enforced before cloud restoration", async () => {
  expect(() => encodeBundle([{ path: "../outside", content: "", mode: 0o600 }])).toThrow();
  expect(() => decodeBundle("a".repeat(48 * 1024 + 1))).toThrow("limit");

  const fixture = await guidanceFixture();

  try {
    const encoded = gzipSync(
      JSON.stringify([
        { path: "plugins/shadowclone-personal/../../../outside", content: "", mode: 0o600 },
      ]),
    ).toString("base64");
    await expect(
      restoreGuidance({ encoded, destination: path.join(fixture.root, "restore") }),
    ).rejects.toThrow();
  } finally {
    await fixture.cleanup();
  }
});
