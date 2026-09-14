import { z } from "zod";
import { parseJson } from "./structured";

const requestSchema = z.object({
  kind: z.enum(["correctness", "preferences"]),
  requirements: z.array(z.object({ id: z.string(), requirement: z.string() })),
  candidate: z.string(),
  vote: z.number(),
});

export function judgeRequest(prompt: string) {
  return requestSchema.parse(parseJson(prompt.split("\n").at(-1) ?? ""));
}

export function engineRun(structured: unknown) {
  return {
    engine: "codex" as const, sessionId: "judge-session", transcriptPath: null,
    text: "", structured, costUsd: null, durationMs: 1, turns: 1,
    actions: [], permissionDenials: [], isError: false, errorMessage: null,
  };
}

export function batchReply(options: {
  readonly prompt: string;
  readonly verdict?: "pass" | "fail";
}) {
  return engineRun({
    checks: judgeRequest(options.prompt).requirements.map((requirement) => ({
      id: requirement.id, verdict: options.verdict ?? "pass", evidence: "parser.ts satisfies the criterion",
    })),
  });
}
