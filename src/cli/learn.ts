import { readConfig } from "../config";
import {
  ingestSources,
  openEventIndex,
} from "../index";
import { projectPaths } from "../paths";
import type { ProjectPaths } from "../paths";

export async function learn(options: {
  readonly configPath?: string;
  readonly databasePath?: string;
  readonly paths?: ProjectPaths;
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
    console.log(
      `Indexed ${summary.events} events from ${summary.files} files across ${summary.sessions} sessions (${summary.bytesRead} bytes read).`,
    );
  } finally {
    index.close();
  }
}
