import { mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runProcess } from "../../../io/process";
import { fingerprint } from "../../transfer/structured";
import {
  judgmentOutputSchema,
  legacyJudgmentOutputSchema,
} from "../judgeSchema";
import { probeClaudeSchema } from "./probe";
import {
  contractProofSchema,
  legacySchemaFailure,
  type ClaudeContractProof,
} from "./schema";

export {
  contractProofSchema,
  legacySchemaFailure,
  type ClaudeContractProof,
} from "./schema";

export async function verifyClaudeContract(): Promise<ClaudeContractProof> {
  const location = Bun.which("claude");

  if (!location) {
    throw new Error("Claude CLI is unavailable for the schema contract check");
  }

  const executable = await realpath(location);
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-schema-contract-"),
  );

  try {
    const version = await runProcess({
      arguments: [executable, "--version"],
      cwd: directory,
      environment: { PATH: process.env.PATH },
      timeoutMilliseconds: 10000,
    });

    if (version.exitCode !== 0) {
      throw new Error("Claude CLI version could not be verified");
    }

    const legacy = await probeClaudeSchema({
      executable,
      directory,
      schema: legacyJudgmentOutputSchema,
    });

    if (
      legacy.messages !== 0 ||
      legacy.exitCode === 0 ||
      legacy.failure !== legacySchemaFailure
    ) {
      throw new Error(
        `Legacy schema pre-request rejection was not established: ${legacy.failure}`,
      );
    }

    const current = await probeClaudeSchema({
      executable,
      directory,
      schema: judgmentOutputSchema,
    });

    if (current.messages === 0) {
      throw new Error(
        `Corrected judge schema did not reach the local messages endpoint: ${current.failure}`,
      );
    }

    return contractProofSchema.parse({
      checkedAt: Date.now(),
      cliVersion: version.stdout.trim(),
      executableFingerprint: new Bun.CryptoHasher("sha256")
        .update(await Bun.file(executable).arrayBuffer())
        .digest("hex"),
      legacySchemaFingerprint: fingerprint(legacyJudgmentOutputSchema),
      currentSchemaFingerprint: fingerprint(judgmentOutputSchema),
      legacyMessages: legacy.messages,
      currentMessages: current.messages,
      legacyFailure: legacy.failure,
      network: "loopback-only",
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
