import { setupTransferEval } from "../../transfer/setup";
import { validateScenarios } from "../prepare";
import type { GuidanceOptions } from "../run";
import { guidanceDirectory, readGuidanceSuite } from "../store";
import { maintenanceIdentity, validateMaintenanceDelta } from "./change";
import { maintenanceParent } from "./parent";
import { readMaintenanceManifest, verifyMaintenanceRevision } from "./prepare";
import { maintenanceSchema } from "./schema";

export async function setupMaintenance(requested: GuidanceOptions) {
  if (
    !requested.maintenanceOf ||
    !requested.suiteId ||
    !requested.additionalBudgetUsd ||
    requested.additionalBudgetUsd > 10 ||
    requested.model !== "claude-sonnet-5" ||
    requested.maximumCalls > 48 ||
    requested.deadlineSeconds > 2700 ||
    requested.maxBudgetUsd !== undefined ||
    requested.cumulativeBudgetUsd !== undefined ||
    requested.validationOf ||
    requested.evalId ||
    requested.pilot ||
    requested.scenarioFile ||
    requested.recoverPreflightFailure
  ) {
    throw new Error(
      "Maintenance requires a parent, frozen suite, at most $10 additional, 48 calls and 45 minutes, with exact Sonnet 5",
    );
  }

  const setup = await setupTransferEval({
    repo: requested.repo,
    engine: "claude-code",
    model: requested.model,
    reasoningEffort: "medium",
    paths: requested.paths,
    runner: requested.runner,
  });

  const { parent, accounting } = await maintenanceParent({
    paths: setup.paths,
    parentEvalId: requested.maintenanceOf,
  });

  if (parent.judging?.version !== 2) {
    throw new Error("Original repository evidence is missing");
  }

  if (
    parent.model !== requested.model ||
    parent.suite.repository !== setup.repository
  ) {
    throw new Error(
      "Maintenance must retain the original model and repository",
    );
  }

  const suite = await readGuidanceSuite({
    paths: setup.paths,
    suiteId: requested.suiteId,
  });
  const manifest = await readMaintenanceManifest({
    paths: setup.paths,
    suiteId: suite.suiteId,
  });

  if (manifest.parentEvalId !== parent.evalId) {
    throw new Error("Maintenance manifest belongs to a different parent");
  }

  validateMaintenanceDelta({ parent: parent.suite, suite, manifest });
  validateScenarios(suite);
  await verifyMaintenanceRevision({ paths: setup.paths, manifest });

  const maintenance = maintenanceSchema.parse({
    version: 1,
    parentEvalId: parent.evalId,
    ...accounting,
    additionalLimitUsd: requested.additionalBudgetUsd,
    windowSeconds: requested.deadlineSeconds,
    resolvedModel: "claude-sonnet-5",
    manifest,
  });

  const evalId = maintenanceIdentity({
    parentId: parent.evalId,
    kind: "evaluation",
  });
  const directory = guidanceDirectory({ paths: setup.paths, evalId });

  return {
    setup,
    parent,
    suite,
    maintenance,
    evalId,
    directory,
    repositoryEvidence: parent.judging.packet,
  };
}
