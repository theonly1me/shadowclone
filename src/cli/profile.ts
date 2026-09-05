import type { ShadowcloneConfig } from "../config";
import type { EventIndex } from "../index";
import type { ProjectPaths } from "../paths";
import {
  buildProfileRules,
  writeProfile,
} from "../profile";
import { deriveSignals } from "../signal";
import type { GitRemoteReader } from "../signal";

export async function refreshOfflineProfile(options: {
  readonly index: EventIndex;
  readonly config: ShadowcloneConfig;
  readonly paths: ProjectPaths;
  readonly readRemote?: GitRemoteReader;
  readonly blockedOrigins?: readonly string[];
}): Promise<void> {
  const events = options.index.listEvents();
  const derived = await deriveSignals({
    events,
    corpus: options.index.getCorpusSummary(),
    gitMetadataEnabled: options.config.sources["git-metadata"],
    readRemote: options.readRemote,
    blockedOrigins: options.blockedOrigins,
  });
  const rules = buildProfileRules({
    events: derived.events,
    signals: derived.corrections,
    origins: derived.origins,
  });
  await writeProfile({ paths: options.paths, rules });
}
