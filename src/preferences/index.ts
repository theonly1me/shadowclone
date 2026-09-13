import { readEffectiveConfig } from "../config";
import { refreshIntegrations } from "../integrations";
import { fingerprint } from "../localFiles";
import { projectPaths, type ProjectPaths } from "../paths";
import { writeProfile, type ProfileRule } from "../profile";
import { redactSecrets } from "../redact";
import { isOriginBlocked, resolveRepository, type GitRemoteReader } from "../signal";

export async function rememberPreference(options: {
  readonly text: string;
  readonly scope: "global" | "repository";
  readonly cwd?: string;
  readonly paths?: ProjectPaths;
  readonly managedConfigPath?: string | null;
  readonly readRemote?: GitRemoteReader;
}): Promise<string> {
  if (!options.text.trim() || Buffer.byteLength(options.text) > 8_192) throw new Error("Preference must contain between 1 and 8192 bytes");
  const paths = options.paths ?? projectPaths;
  const { config, policy } = await readEffectiveConfig({ configPath: paths.configFile, managedConfigPath: options.managedConfigPath === undefined ? paths.managedConfigFile : options.managedConfigPath });
  if (!policy.enabled) throw new Error("Shadowclone is disabled by managed policy");
  const repository = await resolveRepository({ cwd: options.cwd ?? process.cwd(), enabled: config.sources["git-metadata"], readRemote: options.readRemote });
  if (isOriginBlocked({ repository, patterns: policy.blockedOrigins })) throw new Error("Managed policy blocks preferences for this repository");
  const body = redactSecrets({ text: options.text }).trim().replace(/^#{1,6}\s+/gm, "").replace(/<!--/g, "&lt;!--").replace(/-->/g, "--&gt;");
  const location = options.scope === "global"
    ? { scope: "global" as const, originDirectory: null, repositoryName: null }
    : repository.profileFileName
      ? { scope: "project" as const, originDirectory: repository.origin.directoryName, repositoryName: repository.profileFileName }
      : { scope: "org" as const, originDirectory: repository.origin.directoryName, repositoryName: null };
  const key = `declared-${fingerprint(JSON.stringify({ body, location })).slice(0, 24)}`;
  const rule: ProfileRule = {
    ...location, key, title: "Explicit engineering preference", body, section: "engineering", source: "declared", status: "active",
    proposal: null, appliesWhen: [], evidence: { for: [], against: [] }, observations: 0, sessions: 0,
    lastSeen: new Date().toISOString(), origins: [], importReference: null,
  };
  await writeProfile({ paths, rules: [rule] });
  await refreshIntegrations({ paths, configPath: paths.configFile, managedConfigPath: options.managedConfigPath, readRemote: options.readRemote });
  return key;
}
