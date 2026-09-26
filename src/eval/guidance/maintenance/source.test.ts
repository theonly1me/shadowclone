import { expect, test } from "bun:test";
import { mkdtemp, rm, mkdir, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { canonicalPath } from "../../../paths";
import { fingerprint } from "../../transfer/structured";
import { candidateFixture, guidanceFixture } from "../fixtures";
import { judgeGuidance } from "../judge";
import { captureJudgePacket, judgeEvidencePaths } from "../judgeEvidence";
import { captureSourceJudging, historicalSources, validateSourceJudging, validateSourcePacket } from "../sourceEvidence";
import { correctedPath } from "./change";

test("complete anonymous historical sources reach every advice judge identically", async () => {
  const directory = canonicalPath(await mkdtemp(path.join(os.tmpdir(), "maintenance-sources-")));
  try {
    for (const sourcePath of judgeEvidencePaths) await Bun.write(path.join(directory, sourcePath), "Repository fact sk-proj-abcdefghijklmnopqrstuv\n");
    await Bun.write(path.join(directory, correctedPath), "Synthetic test");
    const suite = { ...guidanceFixture(), memory: historicalSources.map((relativePath) => ({ relativePath, content: "---\nsource: claude-memory\n---\nComplete source\nVerified 2026-09-08 on both packages.\n" })) };
    const judging = await captureSourceJudging({ directory, suite });
    expect(JSON.stringify(judging.packet)).not.toContain("abcdefghijklmnopqrstuv");
    expect(JSON.stringify(judging.packet)).not.toContain("claude-memory");
    expect(judging.packet.documents[4]?.numberedContent).toContain("Verified 2026-09-08");
    expect(judging.provenance[4]?.path).toBe(historicalSources[0]);
    expect(judging.packet.locations.map((location) => location.exists)).toEqual([false, true, false, true]);
    const repository = await captureJudgePacket({ directory, commit: suite.baseCommit });
    expect(() => validateSourceJudging({ judging, suite, repository })).not.toThrow();
    const scenario = suite.scenarios.find((entry) => entry.mode === "advice");
    if (!scenario) throw new Error("Advice scenario missing");
    const prompts: string[] = [];
    for (const arm of ["bare", "skills", "memory", "clone"] as const) await judgeGuidance({
      scenario: { ...scenario, criteria: scenario.criteria.map((criterion) => ({ ...criterion, source: { path: historicalSources[0], quote: "Complete source" } })) },
      candidate: { ...candidateFixture(), arm }, vote: 1, cwd: directory, sourceJudging: judging,
      call: async (request) => {
        prompts.push(request.prompt);
        return { engine: "claude-code", sessionId: "synthetic", transcriptPath: null, text: "", structured: { checks: [{ id: "complete-names", verdict: "pass", evidence: "Supported historical attribution." }] },
          costUsd: 0, durationMs: 0, turns: 1, isError: false, permissionDenials: [], actions: [], errorMessage: null };
      },
    });
    expect(new Set(prompts).size).toBe(1);
    expect(prompts[0]).toContain("not a claim of execution in the current session");
    expect(prompts[0]).toContain("A valid command does not excuse a conflicting runnable alternative");
    expect(prompts[0]).toContain("Verified 2026-09-08");
    for (const hidden of ['"arm"', "requiredSkills", "memory/reference_", "claude-memory", '"provenance"']) expect(prompts[0]).not.toContain(hidden);
    const altered = { ...judging, provenance: judging.provenance.map((entry) => ({ ...entry, path: "changed" })) };
    expect(() => validateSourceJudging({ judging: altered, suite, repository })).toThrow("provenance");
    const truncated = { ...judging.packet, documents: judging.packet.documents.map((document) => ({ ...document, numberedContent: "1: Truncated", contentHash: fingerprint("Truncated") })) };
    expect(() => validateSourceJudging({ judging: { ...judging, packet: truncated, packetFingerprint: fingerprint(truncated) }, suite, repository })).toThrow("provenance");
    expect(() => validateSourcePacket({ ...judging.packet, documents: [...judging.packet.documents].reverse() })).toThrow("identifiers");
    expect(() => validateSourcePacket({ ...judging.packet, locations: [] })).toThrow("location");
    await expect(captureSourceJudging({ directory, suite: { ...suite, memory: [] } })).rejects.toThrow("missing");
    await expect(captureSourceJudging({ directory, suite: { ...suite, memory: suite.memory.map((file) => ({ ...file, content: "x".repeat(40000) })) } })).rejects.toThrow("64 KiB");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("source evidence rejects a repository location symlink escape", async () => {
  const directory = canonicalPath(await mkdtemp(path.join(os.tmpdir(), "maintenance-escape-")));
  try {
    for (const sourcePath of judgeEvidencePaths) await Bun.write(path.join(directory, sourcePath), "Repository fact");
    await mkdir(path.join(directory, "packages"));
    await symlink(canonicalPath(os.tmpdir()), path.join(directory, "packages/example"));
    const suite = { ...guidanceFixture(), memory: historicalSources.map((relativePath) => ({ relativePath, content: "Historical source" })) };
    await expect(captureSourceJudging({ directory, suite })).rejects.toThrow("escapes");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
