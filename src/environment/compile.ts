import type { ProjectPaths } from "../paths";
import { compileProfile, type ProfileCompilation } from "../profile";
import type { RepositoryIdentity } from "../signal";
import { environmentCompilation } from "./context";

export async function compileAgentDelivery(options: {
  readonly paths: ProjectPaths; readonly cwd: string; readonly repository: RepositoryIdentity; readonly outputPath?: string;
}): Promise<ProfileCompilation> {
  const environment = await environmentCompilation({ paths: options.paths, cwd: options.cwd, originDirectory: options.repository.origin.directoryName, repositoryName: options.repository.profileFileName });
  if (environment !== null) {
    if (options.outputPath) await Bun.write(options.outputPath, environment.markdown, { mode: 0o600 });
    return environment;
  }
  return compileProfile({ input: { kind: "directory", profileDirectory: options.paths.profileDirectory, origin: options.repository.origin, targetRepo: options.repository.profileFileName }, outputPath: options.outputPath });
}
