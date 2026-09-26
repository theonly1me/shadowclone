import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { candidateFixture, guidanceFixture } from "./fixtures";
import { captureJudgePacket, judgeEvidencePaths, validateJudgePacket, type JudgePacket } from "./judgeEvidence";
import { judgeGuidance } from "./judge";

test("judge evidence is redacted, numbered, hashed and rejects missing or oversized sources", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "judge-evidence-"));
  try {
    await expect(captureJudgePacket({ directory, commit: "frozen" })).rejects.toThrow("missing");
    for (const relative of judgeEvidencePaths) await Bun.write(path.join(directory, relative), "Synthetic source\nsk-proj-abcdefghijklmnopqrstuv\n");
    const packet = await captureJudgePacket({ directory, commit: "frozen" });
    expect(packet.commit).toBe("frozen");
    expect(packet.files.map((file) => file.path)).toEqual([...judgeEvidencePaths]);
    expect(packet.files[0]?.numberedContent).toStartWith("1: Synthetic source\n2: ");
    expect(JSON.stringify(packet)).not.toContain("abcdefghijklmnopqrstuv");
    expect(() => validateJudgePacket(packet)).not.toThrow();
    expect(() => validateJudgePacket({ ...packet, files: packet.files.map((file) => ({ ...file, contentHash: "changed" })) })).toThrow("hash");
    expect(() => validateJudgePacket({ ...packet, files: [...packet.files].reverse() })).toThrow("paths");
    for (const relative of judgeEvidencePaths) await Bun.write(path.join(directory, relative), "Synthetic source ".repeat(1400));
    await expect(captureJudgePacket({ directory, commit: "frozen" })).rejects.toThrow("64 KiB");
    await Bun.write(path.join(directory, judgeEvidencePaths[0]), "x".repeat(65537));
    await expect(captureJudgePacket({ directory, commit: "frozen" })).rejects.toThrow("missing");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("grounded judges receive identical anonymous packets without changing criteria", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "judge-grounding-"));
  try {
    for (const relative of judgeEvidencePaths) await Bun.write(path.join(directory, relative), "Synthetic repository fact.");
    const packet: JudgePacket = await captureJudgePacket({ directory, commit: "frozen" });
    const scenario = guidanceFixture().scenarios.find((entry) => entry.mode === "advice");
    if (!scenario) throw new Error("Advice scenario missing");
    const prompts: string[] = [];
    for (const arm of ["bare", "skills", "memory", "clone"] as const) await judgeGuidance({
      scenario, candidate: { ...candidateFixture(), arm }, vote: 1, cwd: directory, packet,
      call: async (request) => {
        prompts.push(request.prompt);
        return { engine: "claude-code", sessionId: "synthetic", transcriptPath: null, text: "", structured: { checks: [{ id: "complete-names", verdict: "pass", evidence: "Source-backed answer." }] },
          costUsd: 0, durationMs: 0, turns: 1, isError: false, permissionDenials: [], actions: [], errorMessage: null };
      },
    });
    expect(new Set(prompts).size).toBe(1);
    expect(prompts[0]).toContain("Missing corroboration is not proof of fabrication");
    expect(prompts[0]).toContain(JSON.stringify(packet));
    expect(prompts[0]).toContain(JSON.stringify(scenario.criteria));
    expect(prompts[0]).not.toContain('"arm"');
    expect(prompts[0]).not.toContain("requiredSkills");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
