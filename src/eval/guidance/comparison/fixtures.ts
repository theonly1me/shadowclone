import path from "node:path";
import { maintenanceFixture } from "../maintenance/fixtures";
import {
  guidanceDirectory,
  readGuidanceReceipt,
  saveGuidanceReceipt,
} from "../store";
import { runComparison } from "./index";

export async function comparisonFixture() {
  const fixture = await maintenanceFixture();
  const initialized = await fixture.initialize();
  const parent = {
    ...initialized,
    status: "complete" as const,
    runs: fixture.parent.runs,
  };

  await saveGuidanceReceipt({ paths: fixture.paths, receipt: parent });

  const parentDirectory = guidanceDirectory({
    paths: fixture.paths,
    evalId: parent.evalId,
  });

  const parentBudget = {
    version: 1,
    limitUsd: 10,
    spentUsd: 7.2567122,
    calls: 48,
    maximumCalls: 48,
    pending: false,
    unknownCost: false,
  };

  await Bun.write(
    path.join(parentDirectory, "budget.json"),
    JSON.stringify(parentBudget),
  );

  const request = {
    ...fixture.request,
    maintenanceOf: undefined,
    suiteId: undefined,
    comparisonOf: parent.evalId,
    additionalBudgetUsd: 20,
    maximumCalls: 96,
    deadlineSeconds: 5400,
  };

  const initialize = () =>
    runComparison({
      options: request,
      execute: async (child) =>
        readGuidanceReceipt({
          paths: fixture.paths,
          evalId: child.evalId ?? "",
        }),
    });

  return {
    ...fixture,
    prior: fixture.parent,
    parent,
    parentDirectory,
    parentBudget,
    request,
    initialize,
  };
}
