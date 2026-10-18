import { describe, expect, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { temporaryHome } from "./fixtures";
import { installLiveHooks } from "./install";

const launcher = 'sh "$HOME/.shadowclone/bin/shadowclone"';

describe("installing the live session hooks", () => {
  test("enable adds the hooks beside the owner's own, and disable removes only shadowclone's", async () => {
    const { home, remove } = await temporaryHome();
    const settings = path.join(home, ".claude", "settings.json");
    const own = { hooks: [{ type: "command", command: "say done" }] };

    try {
      await mkdir(path.dirname(settings), { recursive: true });
      await writeFile(settings, JSON.stringify({ model: "opus", hooks: { Stop: [own] } }));

      const enabled = await installLiveHooks({ home, launcher, remove: false });
      const installed = JSON.parse(await readFile(settings, "utf8"));

      expect(enabled).toEqual({
        changed: [settings],
        skipped: [path.join(home, ".codex", "hooks.json")],
      });
      expect(installed.model).toBe("opus");
      expect(installed.hooks.Stop).toEqual([
        own,
        { hooks: [{ type: "command", command: `${launcher} live hook claude`, timeout: 10 }] },
      ]);
      expect(installed.hooks.PostToolUse[0].hooks[0].command).toBe(
        `[ -e "$HOME/.shadowclone/live/pending" ] && ${launcher} live hook claude || true`,
      );

      await installLiveHooks({ home, launcher, remove: true });

      expect(JSON.parse(await readFile(settings, "utf8"))).toEqual({
        model: "opus",
        hooks: { Stop: [own] },
      });
    } finally {
      await remove();
    }
  });

  test("a hook file that is not JSON stays unchanged", async () => {
    const { home, remove } = await temporaryHome();
    const hooks = path.join(home, ".codex", "hooks.json");

    try {
      await mkdir(path.dirname(hooks), { recursive: true });
      await writeFile(hooks, "{ not json");

      await expect(installLiveHooks({ home, launcher, remove: false })).rejects.toThrow(
        "The hook file is not valid JSON, so shadowclone leaves it unchanged.",
      );
      expect(await readFile(hooks, "utf8")).toBe("{ not json");
    } finally {
      await remove();
    }
  });
});
