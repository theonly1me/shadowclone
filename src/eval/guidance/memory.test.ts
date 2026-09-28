import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { captureCurrentMemory, captureVerifiedMemory } from "./memory";
import { guidanceFixture } from "./fixtures";
import { readGuidanceScenarios } from "./prepare";

test("one-shot memory capture verifies hashes and redacts at the materialization gate", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "guidance-memory-"));

  try {
    const body = "Use token sk-abcdefghijklmnop for this synthetic test.";
    const sourceDirectory = path.join(directory, "memory");

    await Bun.write(
      path.join(sourceDirectory, "reference_credentials.md"),
      body,
    );

    const manifestPath = path.join(directory, "manifest.json");

    await Bun.write(
      manifestPath,
      JSON.stringify({
        schema: 1,
        repositoryId: "repository",
        sourceDirectory,
        createdAt: "2026-09-20T00:00:00.000Z",
        files: [
          {
            filename: "reference_credentials.md",
            hash: new Bun.CryptoHasher("sha256").update(body).digest("hex"),
            bytes: Buffer.byteLength(body),
            kind: "reference",
            disposition: "reference",
          },
        ],
      }),
    );

    const snapshot = await captureVerifiedMemory({
      directory: sourceDirectory,
      manifestPath,
    });

    expect(snapshot[0]?.content).not.toContain("sk-abcdefghijklmnop");
    expect(snapshot[0]?.content).toContain("[redacted:");

    await Bun.write(
      path.join(sourceDirectory, "reference_credentials.md"),
      "Changed source.",
    );

    await expect(
      captureVerifiedMemory({ directory: sourceDirectory, manifestPath }),
    ).rejects.toThrow("does not match");
    await expect(
      captureVerifiedMemory({
        directory: path.join(directory, "empty"),
        manifestPath,
      }),
    ).rejects.toThrow("does not match");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("current Claude memory freezes its own hashes without the old migration manifest", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "guidance-current-memory-"),
  );

  try {
    const note =
      ("---\nname: review\nmetadata:\n  type: feedback\n---\nKeep reviews short. OPENAI_API_KEY=" + ["sk", "proj", "abc123DEF456ghi789JKL"].join("-") + "\n");

    await Bun.write(path.join(directory, "MEMORY.md"), "Read review.md.\n");
    await Bun.write(path.join(directory, "review.md"), note);

    const snapshot = await captureCurrentMemory(directory);

    expect(snapshot.files).toHaveLength(2);
    expect(
      snapshot.hashes.find((file) => file.filename === "review.md")?.hash,
    ).toBe(new Bun.CryptoHasher("sha256").update(note).digest("hex"));
    expect(
      snapshot.files.find((file) => file.relativePath === "memory/review.md")
        ?.content,
    ).not.toContain(["sk", "proj", "abc123DEF456ghi789JKL"].join("-"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("scenario prompts use redacted materialization, not the raw parsed file", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "guidance-scenarios-"),
  );

  try {
    const suite = guidanceFixture();
    const filePath = path.join(directory, "scenarios.json");

    await Bun.write(
      filePath,
      JSON.stringify({
        protocol: "guidance-v1",
        scenarios: suite.scenarios.map((scenario) => ({
          ...scenario,
          prompt:
            "Inspect synthetic token sk-abcdefghijklmnop without exposing it.",
        })),
      }),
    );

    const result = await readGuidanceScenarios(filePath);

    expect(result.scenarios[0]?.prompt).not.toContain("sk-abcdefghijklmnop");
    expect(result.scenarios[0]?.prompt).toContain("[redacted:");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
