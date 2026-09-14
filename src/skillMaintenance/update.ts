import path from "node:path";
import { readEffectiveConfig } from "../config";
import type { LearningExecution } from "../engine";
import { compileContext } from "../integrations";
import { acquireLocalLock } from "../localFiles/lock";
import type { ProjectPaths } from "../paths";
import type { GitRemoteReader } from "../signal";
import { assessSkillBatch } from "./assess";
import { applySkillProposalUnlocked } from "./apply";
import { discoverSkills } from "./discover";
import { assessmentFingerprint, prepareSkillProposal } from "./prepare";
import { saveSkillProposal } from "./proposals";
import { readMaintenanceState, writeMaintenanceState } from "./state";
import { syncPortableSkills } from "./portable";
import { syncPersonalSkills } from "./syncPersonal";
import type { DiscoveredSkill } from "./types";

export type SkillUpdateSummary = { readonly assessed: number; readonly applied: number; readonly pending: number; readonly invalid: number; readonly duplicates: number; readonly deferred: number; readonly verification: number; readonly synced: number; readonly conflicts: number };

function nextSkillBatch(skills: readonly DiscoveredSkill[]): readonly DiscoveredSkill[] {
  const batch: DiscoveredSkill[] = [];
  let bytes = 0;
  for (const skill of skills) {
    if (batch.length === 4 || bytes + Buffer.byteLength(skill.redacted) > 64_000) break;
    batch.push(skill);
    bytes += Buffer.byteLength(skill.redacted);
  }
  return batch;
}

export async function updateSkillLibrary(options: { readonly paths: ProjectPaths; readonly execution?: LearningExecution; readonly syncPersonal?: boolean; readonly managedConfigPath?: string | null; readonly readRemote?: GitRemoteReader }): Promise<SkillUpdateSummary> {
  const empty: SkillUpdateSummary = { assessed: 0, applied: 0, pending: 0, invalid: 0, duplicates: 0, deferred: 0, verification: 0, synced: 0, conflicts: 0 };
  const { config, policy } = await readEffectiveConfig({ configPath: options.paths.configFile, managedConfigPath: options.managedConfigPath === undefined ? options.paths.managedConfigFile : options.managedConfigPath });
  if (!config.sources["skill-library"]) return empty;
  const lock = await acquireLocalLock(path.join(options.paths.shadowcloneDirectory, "skills-worker.db"));
  if (!lock) throw new Error("Another skill update is running");
  try {
    const initialSync = options.syncPersonal
      ? await syncPersonalSkills({ paths: options.paths })
      : await syncPortableSkills({ paths: options.paths });
    if (!config.distillation.deep || policy.distillation !== "allowed" || !options.execution) {
      return { ...empty, ...initialSync };
    }
    let state = await readMaintenanceState(options.paths);
    const profiles = new Map<string, string>();
    for (const root of state.roots) {
      if (!root.enabled) continue;
      const profile = await compileContext({ ...options, cwd: root.cwd, scope: root.scope === "global" ? "global" : "combined" });
      if (profile !== null) profiles.set(root.id, profile);
    }
    const discovered = await discoverSkills(state.roots.filter((root) => profiles.has(root.id)));
    const summary = { ...empty, invalid: discovered.invalid, duplicates: discovered.duplicates, ...initialSync };
    for (const [rootId, profile] of profiles) {
      let pending = discovered.skills.filter((skill) => skill.root.id === rootId && state.assessed[skill.id] !== assessmentFingerprint({ skill, profile }));
      while (pending.length > 0 && options.execution.callsRemaining() > 0) {
        const batch = nextSkillBatch(pending);
        if (batch.length === 0) break;
        const assessments = await assessSkillBatch({ skills: batch, profile, execution: options.execution, cwd: options.paths.shadowcloneDirectory });
        for (const { skill, assessment } of assessments) {
          summary.assessed += 1;
          if (assessment.decision === "needs-verification") summary.verification += 1;
          const prepared = await prepareSkillProposal({ paths: options.paths, skill, assessment, state, profile });
          if (prepared) {
            await saveSkillProposal({ paths: options.paths, proposal: prepared.proposal });
            if (prepared.automatic && discovered.duplicates === 0) {
              await applySkillProposalUnlocked({ paths: options.paths, id: prepared.proposal.id, managedConfigPath: options.managedConfigPath, readRemote: options.readRemote });
              summary.applied += 1;
              state = await readMaintenanceState(options.paths);
            } else summary.pending += 1;
          }
          state = { ...state, assessed: { ...state.assessed, [skill.id]: assessmentFingerprint({ skill, profile }) }, findings: { ...state.findings, [skill.id]: [...assessment.findings, ...(assessment.decision === "needs-verification" ? ["needs-verification"] : [])] } };
          await writeMaintenanceState({ paths: options.paths, state });
        }
        pending = pending.slice(batch.length);
      }
      summary.deferred += pending.length;
    }
    const finalSync = await syncPortableSkills({ paths: options.paths });
    summary.synced += finalSync.synced;
    summary.conflicts += finalSync.conflicts;
    return summary;
  } finally { lock.release(); }
}
