import { expect, test } from "bun:test";
import { verifyClaudeStreamContract } from "./streamProbe";

test.skipIf(process.env.SHADOWCLONE_CLAUDE_CONTRACT !== "1")(
  "installed Claude CLI joins synthetic successful and failed reads around a real file write",
  async () => {
    const proof = await verifyClaudeStreamContract();

    expect(proof.network).toBe("loopback-only");
    expect(proof.messages).toBe(4);
    expect(proof.resolvedModel).toBe("claude-sonnet-5");
    expect(proof.trace.reads.map((read) => read.beforeEdit)).toEqual([
      true,
      false,
    ]);
  },
  60000,
);
