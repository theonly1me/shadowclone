import { expect, test } from "bun:test";
import { verifyClaudeContract } from "./index";

test.skipIf(process.env.SHADOWCLONE_CLAUDE_CONTRACT !== "1")(
  "the installed Claude CLI rejects Draft 2020-12 locally and accepts the Draft 7 judge schema",
  async () => {
    const proof = await verifyClaudeContract();

    expect(proof.legacyMessages).toBe(0);
    expect(proof.currentMessages).toBeGreaterThan(0);
    expect(proof.network).toBe("loopback-only");
  },
  75000,
);
