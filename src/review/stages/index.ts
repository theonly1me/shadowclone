import { analyzeReview, readReviewSkill, type ReviewModel } from "../analyze";
import { collectReview, readPullFacts } from "../collect";
import { cachedFetch, gateFindings } from "../evidence";
import { reviewResult } from "../result";
import { checkBuiltInRules } from "../rules";
import { runToolchain } from "../toolchain";
import type { ReviewResult } from "../types";
import type { ChecksFile, PacketFile } from "./schemas";

export { checksFileSchema, packetFileSchema, type ChecksFile, type PacketFile } from "./schemas";

export async function prepareStage(options: {
  readonly repository: string;
  readonly number: number;
  readonly checkout: string;
  readonly cwd: string;
  readonly head?: string;
}): Promise<PacketFile> {
  const current = await readPullFacts({ repository: options.repository, number: options.number, cwd: options.cwd });
  const facts = options.head === undefined ? current : { ...current, headSha: options.head };
  const context = await collectReview({ checkout: options.checkout, facts });

  return { version: 1, context, ruleHits: checkBuiltInRules(context.files) };
}

export async function checksStage(options: {
  readonly packet: PacketFile;
  readonly repository: string;
  readonly workDirectory: string;
  readonly onProgress: (message: string) => void;
}): Promise<ChecksFile> {
  const { facts, files } = options.packet.context;
  const reports = await runToolchain({
    repository: options.repository,
    baseSha: facts.baseSha,
    headSha: facts.headSha,
    files,
    workDirectory: options.workDirectory,
    onProgress: options.onProgress,
  });

  return { version: 1, headSha: facts.headSha, reports };
}

export async function analyzeStage(options: {
  readonly packet: PacketFile;
  readonly checks: ChecksFile | null;
  readonly checkout: string;
  readonly reviewModel: ReviewModel;
  readonly fetchText?: (url: string) => Promise<string | null>;
}): Promise<ReviewResult> {
  const startedAt = Date.now();
  const { packet, checks } = options;

  if (checks !== null && checks.headSha !== packet.context.facts.headSha) {
    throw new Error("The toolchain results belong to a different head commit.");
  }

  const reviewPacket = { context: packet.context, ruleHits: packet.ruleHits, toolchain: checks?.reports ?? [] };
  const analysis = await analyzeReview({
    reviewModel: options.reviewModel,
    checkout: options.checkout,
    packet: reviewPacket,
    skill: await readReviewSkill(),
  });

  const gate = await gateFindings({
    findings: analysis.findings,
    sources: {
      checkout: options.checkout,
      files: packet.context.files,
      ruleHits: packet.ruleHits,
      toolchain: reviewPacket.toolchain,
      fetchText: cachedFetch(options.fetchText),
    },
  });

  return reviewResult({
    packet: reviewPacket,
    modelFindings: gate.kept,
    dropped: gate.dropped,
    model: options.reviewModel.model,
    costUsd: analysis.costUsd,
    startedAt,
  });
}
