import path from "node:path";
import type { EvaluationBudget } from "../transfer/accounting";
import { modelCaller } from "../transfer/call";
import type { ResolvedTransferSetup } from "../transfer/setup";
import type { ModelCall } from "../transfer/types";
import type { GuidanceOptions } from "./runOptions";
import type { GuidanceReceipt } from "./schema";

export function guidanceModelCall(input: {
  readonly requested: GuidanceOptions;
  readonly setup: ResolvedTransferSetup;
  readonly budget: EvaluationBudget;
  readonly engine: "claude-code" | "codex";
  readonly controlDirectory: string;
  readonly progress: { receipt: GuidanceReceipt };
}): ModelCall {
  const {
    requested: options,
    setup,
    budget,
    engine,
    controlDirectory,
    progress,
  } = input;

  const baseCall = modelCaller({
    runner: setup.runner,
    budget,
    engine,
    model: options.model,
    reasoningEffort: "medium",
    timeoutSeconds: 180,
    maxBudgetUsd: options.maxBudgetUsd,
    blockedPaths: [
      setup.repository,
      setup.paths.shadowcloneDirectory,
      setup.paths.claudeProjectsDirectory,
      ...[
        ".claude/skills",
        ".claude/CLAUDE.md",
        ".agents/skills",
        ".codex/skills",
        ".codex/memories",
      ].map((relative) =>
        path.join(path.dirname(setup.paths.shadowcloneDirectory), relative),
      ),
    ],
    controlDirectory,
  });

  return async (request) => {
    const response = await baseCall(request);
    const receipt = progress.receipt;

    if (
      (receipt.maintenance || receipt.comparison) &&
      (response.costUsd === null ||
        !Number.isFinite(response.costUsd) ||
        response.costUsd < 0)
    ) {
      throw new Error(
        "Evaluation cost is unknown; stop without another invocation",
      );
    }

    if (
      !response.resolvedModel ||
      !(
        response.resolvedModel === options.model ||
        response.resolvedModel.startsWith(`${options.model}-`)
      )
    ) {
      throw new Error(
        `Requested ${options.model}; received ${response.resolvedModel ?? "unknown model"}`,
      );
    }

    if (
      receipt.validation &&
      response.resolvedModel !== receipt.validation.resolvedModel
    ) {
      throw new Error("Resolved model differs from the original pilot");
    }

    if (
      receipt.maintenance &&
      response.resolvedModel !== receipt.maintenance.resolvedModel
    ) {
      throw new Error(
        "Resolved model differs from the approved maintenance model",
      );
    }

    if (
      receipt.comparison &&
      response.resolvedModel !== receipt.comparison.resolvedModel
    ) {
      throw new Error(
        "Resolved model differs from the approved comparison model",
      );
    }

    const previous = receipt.runs[0]?.resolvedModel;

    if (previous && previous !== response.resolvedModel) {
      throw new Error("Resolved model changed during the evaluation");
    }

    return response;
  };
}
