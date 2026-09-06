import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { captureContext } from "./context";

const plantedSecret = "sk_live_0123456789abcdefghij";

async function agentHome(): Promise<string> {
  const home = await mkdtemp(path.join(os.tmpdir(), "shadowclone-context-"));
  await Bun.write(
    path.join(home, ".claude/CLAUDE.md"),
    `Deploy with the key ${plantedSecret} before release.`,
  );
  await Bun.write(
    path.join(home, ".claude/skills/deploy/SKILL.md"),
    `Run the deploy script with ${plantedSecret}.`,
  );
  return home;
}

test("reads nothing when the agent-context source is disabled", async () => {
  const home = await agentHome();

  try {
    expect(
      await captureContext({
        enabled: false,
        home,
        repository: "/repository",
        engine: "claude-code",
      }),
    ).toEqual([]);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("redacts a planted secret out of captured agent instructions and skills", async () => {
  const home = await agentHome();

  try {
    const files = await captureContext({
      enabled: true,
      home,
      repository: "/repository",
      engine: "claude-code",
    });

    expect(files.length).toBeGreaterThan(1);
    for (const file of files) {
      expect(file.content).not.toContain(plantedSecret);
    }
    expect(files.map((file) => file.relativePath)).toContain(
      "instructions/0.md",
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("refuses a baseline whose instructions already carry a Shadowclone profile", async () => {
  const home = await agentHome();

  try {
    await Bun.write(
      path.join(home, ".claude/CLAUDE.md"),
      "# Shadowclone profile\n\nAlready injected.",
    );

    expect(
      captureContext({
        enabled: true,
        home,
        repository: "/repository",
        engine: "claude-code",
      }),
    ).rejects.toThrow("baseline cannot be isolated");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
