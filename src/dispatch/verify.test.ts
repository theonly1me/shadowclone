import { mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "bun:test";
import { detectVerificationTools } from "./verify";

test("falls back to default tools when cwd has no manifests", async () => {
  const tools = await detectVerificationTools({});
  expect(tools).toContain("Bash(bun test:*)");
  expect(tools).toContain("Bash(bun run typecheck:*)");
});

test("detects bun when bun.lock is present", async () => {
  const dir = path.join(os.tmpdir(), `verify-bun-${crypto.randomUUID()}`);
  await mkdir(dir, { recursive: true });
  await Bun.write(path.join(dir, "bun.lock"), "");
  try {
    const tools = await detectVerificationTools({ cwd: dir });
    expect(tools).toContain("Bash(bun test:*)");
    expect(tools).toContain("Bash(bun run typecheck:*)");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("detects cargo when Cargo.toml is present", async () => {
  const dir = path.join(os.tmpdir(), `verify-cargo-${crypto.randomUUID()}`);
  await mkdir(dir, { recursive: true });
  await Bun.write(path.join(dir, "Cargo.toml"), "");
  try {
    const tools = await detectVerificationTools({ cwd: dir });
    expect(tools).toContain("Bash(cargo test:*)");
    expect(tools).toContain("Bash(cargo check:*)");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("honors explicit verification tool overrides", async () => {
  const tools = await detectVerificationTools({
    overrides: ["pytest -v", "ruff check"],
  });
  expect(tools).toEqual(["Bash(pytest -v:*)", "Bash(ruff check:*)"]);
});
