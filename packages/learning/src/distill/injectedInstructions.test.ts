import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { EngineRunner } from "@shadowclone/agents";
import type { CorrectionSignal, IndexedEvent } from "@shadowclone/sessions";
import { distillSignals } from "./index";

const injectedInstructions = [
  "# AGENTS.md instructions for /work/tally",
  "",
  "<INSTRUCTIONS>",
  "Personal rule: never use the em dash.",
  "",
  "<shadowclone-guidance>",
  "Global routing.",
  "</shadowclone-guidance>",
  "",
  "<shadowclone-guidance>",
  "Repository routing.",
  "</shadowclone-guidance>",
  "</INSTRUCTIONS>",
].join("\n");
const userPrompt = "Always run the tally checks before you push.";

function codexUserLine(text: string): string {
  return JSON.stringify({ type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text }] } });
}

async function promptsSentFor(texts: readonly string[]): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-injected-"));
  try {
    const sourcePath = path.join(directory, "rollout.jsonl");
    const lines = texts.map(codexUserLine);
    await Bun.write(sourcePath, `${lines.join("\n")}\n`);
    const prompts: string[] = [];
    const runner: EngineRunner = (run) => {
      prompts.push(run.prompt);
      return Promise.resolve({
        engine: "claude-code", sessionId: "engine", transcriptPath: null, text: "",
        structured: { existingRules: [], newRules: [] }, costUsd: 0.01, durationMs: 1, turns: 1,
        isError: false, permissionDenials: [], actions: [], errorMessage: null,
      });
    };
    let byteOffset = 0;
    const signals: CorrectionSignal[] = lines.map((line, position) => {
      const textRef = { type: "file" as const, sourcePath, byteOffset, byteLength: Buffer.byteLength(line) };
      byteOffset += Buffer.byteLength(`${line}\n`);
      return {
        kind: "user-steering", category: "user-episode", label: "synthetic", sessionId: `codex:session-${position}`,
        timestamp: 1_788_537_600_000 + position, origin: { id: "github.com/acme", directoryName: "github.com--acme", promotable: true },
        repositoryName: null, textRefs: [textRef],
      };
    });
    const events: IndexedEvent[] = signals.map((signal, position) => ({
      id: position + 1, sourcePath, source: "codex", sessionId: signal.sessionId, eventId: `event-${position}`, parentEventId: null,
      timestamp: signal.timestamp, cwd: "/work/tally", gitBranch: null, kind: "user-prompt", tool: null, isError: false,
      textRef: signal.textRefs[0] ?? null,
    }));

    await distillSignals({ signals, runner, engine: "claude-code", workingDirectory: directory, sourceRoots: [directory], events });

    return prompts.join("\n");
  } finally { await rm(directory, { recursive: true, force: true }); }
}

test("Codex instruction injections are not evidence and do not stop learning", async () => {
  const sent = await promptsSentFor([injectedInstructions, userPrompt]);

  expect(sent).toContain(userPrompt);
  expect(sent).not.toContain("Personal rule: never use the em dash.");
});

test("a pasted prompt with two guidance sections keeps the user's words and drops the guidance", async () => {
  const pasted = `Keep this note.\n\n<shadowclone-guidance>\nGlobal routing.\n</shadowclone-guidance>\n\n<shadowclone-guidance>\nRepository routing.\n</shadowclone-guidance>\nAlways run the tally checks.`;
  const sent = await promptsSentFor([pasted]);

  expect(sent).toContain("Always run the tally checks.");
  expect(sent).not.toContain("Repository routing.");
});
