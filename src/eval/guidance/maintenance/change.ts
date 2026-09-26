import { parseReference, referenceRelativePath, renderReference } from "../../../references";
import { fingerprint } from "../../transfer/structured";
import type { GuidanceSuite } from "../schema";
import type { MaintenanceManifest } from "./schema";

export const referencePath = "references/reference_second_source.md";
export const incorrectPath = "packages/example/src/session.test.ts";
export const correctedPath = "services/example/src/session.test.ts";
export const focusedRequirement = "Recommend a documented focused test command from the correct package directory. Every alternative explicitly recommended as runnable must have a valid directory and command shape; one valid command does not excuse a conflicting runnable alternative. Do not claim execution in the current session. Supported historical execution attributed to its recorded source is permitted.";

export function maintenanceIdentity(options: { readonly parentId: string; readonly kind: "suite" | "evaluation" }): string {
  const hash = fingerprint({ purpose: `guidance-maintenance-${options.kind}-v1`, parentId: options.parentId });
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export function correctedReference(options: { readonly content: string; readonly updatedAt: string }): string {
  const record = parseReference(options.content);
  if (record?.key !== "reference_second_source" || record.body.split(incorrectPath).length !== 2) throw new Error("Expected stale reference does not match the approved correction");
  return renderReference({ ...record, body: record.body.replace(incorrectPath, correctedPath), updatedAt: options.updatedAt });
}

export function deriveMaintenanceSuite(options: { readonly parent: GuidanceSuite; readonly parentEvalId: string; readonly updatedAt: string }): GuidanceSuite {
  if (options.parent.references.filter((file) => file.relativePath === referencePath).length !== 1 ||
    options.parent.scenarios.flatMap((scenario) => scenario.criteria.filter((criterion) => criterion.id === "focused-test-command")).length !== 1) throw new Error("Maintenance source or criterion missing");
  const references = options.parent.references.map((file) => file.relativePath === referencePath
    ? { ...file, content: correctedReference({ content: file.content, updatedAt: options.updatedAt }) } : file);
  const suite = { ...options.parent, suiteId: maintenanceIdentity({ parentId: options.parentEvalId, kind: "suite" }), references,
    scenarios: options.parent.scenarios.map((scenario) => ({ ...scenario, criteria: scenario.criteria.map((criterion) =>
      criterion.id === "focused-test-command" ? { ...criterion, requirement: focusedRequirement } : criterion) })) };
  return { ...suite, sourcesFingerprint: fingerprint({ context: suite.context, memory: suite.memory, references, profile: suite.profile }) };
}

export function validateMaintenanceDelta(options: { readonly parent: GuidanceSuite; readonly suite: GuidanceSuite; readonly manifest: MaintenanceManifest }): void {
  const expected = deriveMaintenanceSuite({ parent: options.parent, parentEvalId: options.manifest.parentEvalId, updatedAt: options.manifest.delta.updatedAt });
  const before = options.parent.references.find((file) => file.relativePath === referencePath);
  const after = expected.references.find((file) => file.relativePath === referencePath);
  const record = before && parseReference(before.content);
  if (!before || !after || fingerprint(expected) !== fingerprint(options.suite) || options.manifest.suiteFingerprint !== fingerprint(options.suite) ||
    !record || options.manifest.delta.relativePath !== referenceRelativePath(record) ||
    options.manifest.parentSuiteFingerprint !== fingerprint(options.parent) || options.manifest.delta.path !== referencePath ||
    options.manifest.delta.beforeHash !== fingerprint(before.content) || options.manifest.delta.afterHash !== fingerprint(after.content) ||
    options.manifest.delta.verifiedCommit !== options.parent.baseCommit || options.manifest.delta.verifiedPath !== correctedPath) throw new Error("Maintenance suite contains an unapproved source delta");
}
