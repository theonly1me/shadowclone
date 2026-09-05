import { readConfig } from "../config";
import {
  ingestSources,
  openEventIndex,
} from "../index";
import { projectPaths } from "../paths";
import type { ProjectPaths } from "../paths";
import {
  buildProfileRules,
  renderMirror,
  writeProfile,
} from "../profile";
import { deriveSignals } from "../signal";
import type { GitRemoteReader } from "../signal";

export async function learn(options: {
  readonly configPath?: string;
  readonly databasePath?: string;
  readonly paths?: ProjectPaths;
  readonly readRemote?: GitRemoteReader;
} = {}): Promise<void> {
  const config = await readConfig({ configPath: options.configPath });
  const paths = options.paths ?? projectPaths;
  const index = await openEventIndex(
    options.databasePath ?? paths.indexDatabase,
  );

  try {
    const summary = await ingestSources({
      index,
      config,
      paths,
    });
    const events = index.listEvents();
    const derived = await deriveSignals({
      events,
      corpus: index.getCorpusSummary(),
      gitMetadataEnabled: config.sources["git-metadata"],
      readRemote: options.readRemote,
    });
    const rules = buildProfileRules({
      events,
      signals: derived.corrections,
      origins: derived.origins,
    });
    await writeProfile({ paths, rules });
    console.log(renderMirror(derived.report));
    if (summary.rescannedFiles > 0) {
      console.log(`\n  Rescanned ${summary.rescannedFiles} rewritten files.`);
    }
  } finally {
    index.close();
  }
}
