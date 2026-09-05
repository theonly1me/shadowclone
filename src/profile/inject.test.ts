import { expect, test } from "bun:test";
import { mkdir, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { OriginScope } from "../signal";
import {
  buildCompiledProfile,
  renderProfileRule,
  writeAgent,
} from "./index";
import type { ProfileRule } from "./index";

function origin(owner: string): OriginScope {
  return {
    id: `github.com/${owner}`,
    directoryName: `github.com--${owner}`,
    promotable: true,
  };
}

function rule(options: {
  readonly owner: string;
  readonly title: string;
  readonly section?: ProfileRule["section"];
}): ProfileRule {
  return {
    key: options.title.toLowerCase().replaceAll(" ", "-"),
    title: options.title,
    body: `Rule for ${options.owner}.`,
    section: options.section ?? "workflow",
    scope: "org",
    originDirectory: `github.com--${options.owner}`,
    observations: 3,
    confidence: 0.8,
    lastSeen: "2026-09-05",
    sessions: 2,
    origins: [`github.com/${options.owner}`],
  };
}

test("compiles global and matching organization rules only", async () => {
  const profileDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-inject-"),
  );
  const globalRule = { ...rule({ owner: "acme", title: "Plan first" }), scope: "global" as const, originDirectory: null };
  const acmeRule = rule({ owner: "acme", title: "Use Bun" });
  const otherRule = rule({ owner: "other", title: "Use Cargo" });
  await mkdir(path.join(profileDirectory, "global"), { recursive: true });
  await mkdir(
    path.join(profileDirectory, "org", "github.com--acme"),
    { recursive: true },
  );
  await mkdir(
    path.join(profileDirectory, "org", "github.com--other"),
    { recursive: true },
  );
  await Bun.write(
    path.join(profileDirectory, "global", "workflow.md"),
    renderProfileRule(globalRule),
  );
  await Bun.write(
    path.join(profileDirectory, "org", "github.com--acme", "workflow.md"),
    renderProfileRule(acmeRule),
  );
  await Bun.write(
    path.join(profileDirectory, "org", "github.com--other", "workflow.md"),
    renderProfileRule(otherRule),
  );

  const profile = await buildCompiledProfile({
    profileDirectory,
    origin: origin("acme"),
  });

  expect(profile).toContain("Plan first");
  expect(profile).toContain("Use Bun");
  expect(profile).not.toContain("Use Cargo");
  expect(profile).not.toContain("<!-- shadowclone:");
});

test("writes a dispatchable agent with advisory boundaries", async () => {
  const targetDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-agent-"),
  );
  const profile = [
    "# Shadowclone profile",
    "",
    "## Requests confirmation after refusing Bash",
    "",
    "Ask before repeating a similar Bash action.",
  ].join("\n");
  const outputPath = await writeAgent({ targetDirectory, profile });
  const agent = await Bun.file(outputPath).text();

  expect(agent).toContain("name: shadowclone");
  expect(agent).toContain(profile);
});
