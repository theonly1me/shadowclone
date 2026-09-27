import path from "node:path";
import { readEffectiveConfig } from "../config";
import type { LearningExecution } from "../engine";
import { readLocalText } from "../localFiles";
import { acquireLocalLock } from "../localFiles/lock";
import type { ProjectPaths } from "../paths";
import { discoverDeliverySkills } from "../skillMaintenance/discover";
import { readMaintenanceState } from "../skillMaintenance/state";
import type { SkillUpdateSummary } from "../skillMaintenance/update";
import { syncPersonalSkills } from "../skillMaintenance/syncPersonal";
import { syncPortableSkills } from "../skillMaintenance/portable";
import { isOriginBlocked, resolveRepository, type GitRemoteReader } from "../signal";
import { environmentFile, readEnvironment, readRedactedEnvironment, renderEnvironment } from "./store";
import { extractMemoryRecords } from "./memory";
import { belongsToScope, learningScopes } from "./scope";
import { recordFingerprint } from "./records";
import { reconcileLearningBatch } from "./reconcile";
import { publishEnvironmentRevision } from "./revision";
import { nativePublication } from "./native";
import { syncLearningEnvironment } from "./sync";

export async function updateLearningEnvironment(options: {
  readonly paths: ProjectPaths; readonly execution?: LearningExecution; readonly syncPersonal?: boolean; readonly managedConfigPath?: string | null; readonly readRemote?: GitRemoteReader;
}): Promise<SkillUpdateSummary | null> {
  const initial = await readEnvironment(options.paths);
  if (initial === null) return null;
  const summary = { assessed: 0, applied: 0, pending: 0, invalid: 0, duplicates: 0, deferred: 0, verification: 0, synced: 0, conflicts: 0 };
  const { config, policy } = await readEffectiveConfig({ configPath: options.paths.configFile, managedConfigPath: options.managedConfigPath === undefined ? options.paths.managedConfigFile : options.managedConfigPath });
  if (!config.sources["skill-library"] || !policy.enabled) return summary;
  if (!initial.automatic) return { ...summary, pending: initial.records.filter(({ rule }) => rule.status === "active" && rule.source !== "imported").length };
  const synchronized = options.syncPersonal ? await syncPersonalSkills({ paths: options.paths }) : await syncPortableSkills({ paths: options.paths });
  summary.synced = synchronized.synced;
  summary.conflicts = synchronized.conflicts;
  if (initial.phase === "active") await syncLearningEnvironment(options.paths);
  if (policy.distillation !== "allowed" || !config.distillation.deep || !options.execution) return summary;
  const lock = await acquireLocalLock(path.join(options.paths.shadowcloneDirectory, "environment-write.db"));
  if (!lock) throw new Error("Another learning environment update is running");
  try {
    const stored = await readEnvironment(options.paths);
    if (stored === null) throw new Error("Learning environment disappeared");
    let state = stored;
    if (!state.automatic) return { ...summary, pending: state.records.length };
    const registered = [];
    for (const repository of state.repositories) {
      const resolved = await resolveRepository({ cwd: repository.directory, enabled: config.sources["git-metadata"], readRemote: options.readRemote });
      if (!isOriginBlocked({ repository: resolved, patterns: policy.blockedOrigins }) && resolved.origin.directoryName === repository.originDirectory && resolved.profileFileName === repository.repositoryName) registered.push(repository);
    }
    const extracted = await extractMemoryRecords({ paths: options.paths, state: { ...state, repositories: registered }, enabled: config.sources["claude-memory"] });
    state = { ...extracted, repositories: state.repositories };
    const filePath = environmentFile(options.paths);
    await publishEnvironmentRevision({ paths: options.paths, updates: [{ filePath, previous: await readLocalText(filePath), next: renderEnvironment(state) }] });
    const maintenance = await readMaintenanceState(options.paths);
    for (const scope of learningScopes({ paths: options.paths, state: { ...state, repositories: registered } })) {
      const roots = maintenance.roots.filter((root) => root.enabled && (scope.repository === null ? root.scope === "global" : root.scope === "repository" && root.cwd === scope.directory));
      let discovered = await discoverDeliverySkills(roots);
      summary.invalid += discovered.invalid;
      summary.duplicates += discovered.duplicates;
      const redacted = await readRedactedEnvironment(options.paths);
      if (redacted === null) throw new Error("Learning environment cannot be resolved");
      const eligible = redacted.records.filter((record) => (record.rule.status === "active" || record.rule.status === "stale" && state.dispositions.some((entry) => entry.key === record.rule.key && entry.status === "published")) && record.rule.proposal === null && record.rule.source !== "imported" && belongsToScope({ record, scope }) && !state.dispositions.some((entry) => entry.key === record.rule.key && entry.scope === scope.key && entry.inputFingerprint === recordFingerprint(record)));
      for (let offset = 0; offset < eligible.length && options.execution.callsRemaining() > 1; offset += 8) {
        discovered = await discoverDeliverySkills(roots);
        const records = eligible.slice(offset, offset + 8);
        const result = await reconcileLearningBatch({ paths: options.paths, state, records, scope, skills: discovered.skills, execution: options.execution });
        const native = result.state.phase === "active" ? await nativePublication({ paths: options.paths, state: result.state, readRemote: options.readRemote }) : { state: result.state, updates: [] };
        await publishEnvironmentRevision({ paths: options.paths, updates: [...result.updates, ...native.updates, { filePath, previous: await readLocalText(filePath), next: renderEnvironment(native.state) }] });
        state = native.state;
        summary.assessed += records.length;
        summary.applied += result.applied;
      }
    }
    summary.pending = state.dispositions.filter(({ status }) => status === "pending").length;
    summary.deferred = state.records.filter((record) => record.rule.status === "active" && record.rule.source !== "imported" && !state.dispositions.some((entry) => entry.key === record.rule.key && entry.inputFingerprint === recordFingerprint(record))).length;
    return summary;
  } finally { lock.release(); }
}
