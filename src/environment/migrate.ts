import { renderProfileRejections } from "../profile/stateRender";
import { readEffectiveConfig } from "../config";
import type { ProjectPaths } from "../paths";
import { canonicalPath } from "../paths";
import { readLegacyProfileSnapshot } from "../profile/snapshot";
import { readScopedReferences } from "../references";
import { resolveRepository, isOriginBlocked, type GitRemoteReader } from "../signal";
import { configureSkillMaintenance } from "../skillMaintenance/configure";
import { readEnvironment, environmentFile, renderEnvironment } from "./store";
import { emptyEnvironment, learningRuleSchema, type EnvironmentState, type LearningRecord } from "./types";
import { freezeOriginalEnvironment } from "./freeze";
import { acquireLocalLock } from "../localFiles/lock";
import path from "node:path";
import { readLocalText } from "../localFiles";
import { publishEnvironmentRevision } from "./revision";
import { ensureBaselineSkill } from "./initialize";
import { legacyManualLearning } from "./legacy";

export async function prepareEnvironmentMigration(options: {
  readonly paths: ProjectPaths; readonly repositories: readonly string[]; readonly automatic: boolean;
  readonly apply: boolean; readonly readRemote?: GitRemoteReader; readonly managedConfigPath?: string | null;
}): Promise<EnvironmentState> {
  const { config, policy } = await readEffectiveConfig({ configPath: options.paths.configFile, managedConfigPath: options.managedConfigPath === undefined ? options.paths.managedConfigFile : options.managedConfigPath });
  if (!policy.enabled) throw new Error("Managed policy blocks environment migration");
  const lock = options.apply ? await acquireLocalLock(path.join(options.paths.shadowcloneDirectory, "environment-write.db")) : null;
  if (options.apply && !lock) throw new Error("Another learning update is running");
  try {
  const previous = await readEnvironment(options.paths);
  const state: EnvironmentState = previous ?? { ...emptyEnvironment };
  const legacy = previous === null ? await readLegacyProfileSnapshot(options.paths) : null;
  const records = new Map<string, LearningRecord>((legacy?.rules ?? []).map(({ rule, promptBody, promptTitle, promptAppliesWhen, promptProposal }) => [rule.key, {
    kind: "guidance", sourceHash: null, sourceLocator: null,
    rule: learningRuleSchema.parse({ ...rule, body: promptBody, title: promptTitle, appliesWhen: promptAppliesWhen, proposal: promptProposal }),
  }]));
  for (const record of state.records) records.set(record.rule.key, record);
  if (previous === null) for (const record of await legacyManualLearning(options.paths)) records.set(record.rule.key, record);
  const repositories = [...state.repositories];
  for (const directory of options.repositories) {
    const repository = await resolveRepository({ cwd: directory, enabled: config.sources["git-metadata"], readRemote: options.readRemote });
    if (isOriginBlocked({ repository, patterns: policy.blockedOrigins }) || repository.profileFileName === null || repository.origin.directoryName.startsWith("isolated--")) throw new Error("Migration requires a verified, consented repository identity");
    const registered = { directory: canonicalPath(directory), originDirectory: repository.origin.directoryName, repositoryName: repository.profileFileName };
    if (!repositories.some((entry) => entry.directory === registered.directory)) repositories.push(registered);
    const references = await readScopedReferences({ profileDirectory: options.paths.profileDirectory, origin: repository.origin, targetRepo: repository.profileFileName });
    for (const { record } of references) {
      const key = `reference:${record.scope}:${record.originDirectory ?? "global"}:${record.repositoryName ?? ""}:${record.key}`;
      if (records.has(key)) continue;
      records.set(key, { kind: "context", sourceHash: null, sourceLocator: record.sourceLocator,
        rule: learningRuleSchema.parse({ key, title: record.title, body: record.body, section: "workflow", source: "user", status: "active", proposal: null,
          scope: record.scope, originDirectory: record.originDirectory, repositoryName: record.repositoryName,
          appliesWhen: record.tags, evidence: { for: [], against: [] }, observations: 1, sessions: 1, lastSeen: record.updatedAt, origins: [], importReference: null }),
      });
    }
  }
  const migrated = { ...state, automatic: options.automatic || state.automatic, records: [...records.values()], repositories,
    rejected: [...new Set([...state.rejected, ...(legacy?.rejections ?? []).map(({ rejection }) => rejection.key)])],
    rejectionText: state.rejectionText || renderProfileRejections((legacy?.rejections ?? []).map(({ rejection, promptTitle, promptBody }) => ({ ...rejection, title: promptTitle, body: promptBody }))) };
  if (!options.apply) return migrated;
  for (const repository of repositories) await configureSkillMaintenance({ scope: "repository", paths: options.paths, cwd: repository.directory, managedConfigPath: options.managedConfigPath });
  const baselineDirectory = state.baselineDirectory ?? await freezeOriginalEnvironment(options.paths);
  const filePath = environmentFile(options.paths);
  await publishEnvironmentRevision({ paths: options.paths, updates: [{ filePath, previous: await readLocalText(filePath), next: renderEnvironment({ ...migrated, baselineDirectory }) }] });
  await ensureBaselineSkill(options.paths);
  return await readEnvironment(options.paths) ?? { ...migrated, baselineDirectory };
  } finally { lock?.release(); }
}
