import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseTransferArguments } from "../../cli/transferEval";
import { prepareTaskFile } from "./taskFile";

test("task files freeze the same prompts while each engine keeps its own preference rubric", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-task-file-"));
  try {
    const filePath = path.join(directory, "tasks.json");
    const tasks = ["Add a parser.", "Add a formatter.", "Add a validator."].map((prompt) => ({ prompt, completion: ["Handle invalid input."] }));
    await Bun.write(filePath, JSON.stringify({ schemaVersion: 1, tasks }));
    const common = { filePath, startingCommit: "frozen-head", count: 3, profile: "Load relevant skills first." };
    const claude = await prepareTaskFile({ ...common, context: [{ relativePath: "skills/clean-code/SKILL.md", content: "Write zero comments." }] });
    const codex = await prepareTaskFile({ ...common, context: [{ relativePath: "skills/clean-code/SKILL.md", content: "Use full words for names." }] });
    expect(claude.map((task) => task.prompt)).toEqual(codex.map((task) => task.prompt));
    expect(claude[0]?.preferences[0]?.rubric?.id).toBe("zero-comments");
    expect(codex[0]?.preferences[0]?.rubric?.id).toBe("complete-names");
    expect(claude[0]?.profileFingerprint).toBe(codex[0]?.profileFingerprint);
    await expect(prepareTaskFile({ ...common, count: 2, context: [] })).rejects.toThrow("count does not match");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("transfer CLI accepts a fixed task file and capped calls", () => {
  expect(parseTransferArguments(["--task-file", "/tmp/tasks.json", "--max-calls", "300", "--tasks", "3"])).toMatchObject({ taskFile: "/tmp/tasks.json", maxCalls: 300, tasks: 3 });
  expect(() => parseTransferArguments(["--task-file", "/tmp/tasks.json", "--task", "Add a parser."])).toThrow("--task or --task-file");
});
