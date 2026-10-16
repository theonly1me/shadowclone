import { expect, test } from "bun:test";
import { syncReportLines } from "./syncReport";

test("an edited instruction file names the file, the reason, and the option that replaces it", () => {
  expect(
    syncReportLines({
      removed: [],
      replaced: [],
      skipped: [
        { kind: "preserved", agent: "codex", path: "/home/ada/.codex/AGENTS.md", reason: "editedManagedContent" },
      ],
    }),
  ).toEqual([
    "Did not update codex: shadowclone kept /home/ada/.codex/AGENTS.md, because its shadowclone section changed after shadowclone wrote it. codex keeps its old routing. To replace the shadowclone content in it, run shadowclone sync --replace-edited.",
    "Synchronized learned skills and native routing for every agent except codex.",
  ]);
});

test("invalid hook JSON asks for a JSON fix, and a replaced file says how to restore it", () => {
  expect(
    syncReportLines({
      removed: [],
      replaced: [{ agent: "pi", path: "/home/ada/.pi/agent/AGENTS.md" }],
      skipped: [
        { kind: "preserved", agent: "antigravity", path: "/home/ada/.gemini/config/hooks.json", reason: "invalidHookConfiguration" },
        { kind: "link", agent: "antigravity", path: "/home/ada/.gemini/GEMINI.md", target: "/srv/shared/AGENTS.md" },
      ],
    }),
  ).toEqual([
    "Replaced the edited shadowclone content in /home/ada/.pi/agent/AGENTS.md for pi. shadowclone history lists the revision that restores it.",
    "Did not update antigravity: shadowclone kept /home/ada/.gemini/config/hooks.json, because its hook configuration is not valid JSON. antigravity keeps its old routing. Fix the JSON, then run shadowclone sync.",
    "Did not update antigravity: /home/ada/.gemini/GEMINI.md is a symbolic link to /srv/shared/AGENTS.md. shadowclone does not write through links, so antigravity keeps its old routing. Replace the link with a regular file, then run shadowclone sync.",
    "Synchronized learned skills and native routing for every agent except antigravity.",
  ]);
});
