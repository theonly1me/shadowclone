import path from "node:path";
import { fingerprint, readConfig, writeConfig } from "@shadowclone/core";
import { normalizeRemoteRepository } from "@shadowclone/sessions";
import { catalogFixture } from "./taskCatalog.fixtures";
import { writeEnvironment } from "./store";

export async function repositoryCatalogFixture(
  options: { readonly privateDelivery?: boolean } = {},
) {
  const setup = await catalogFixture();
  const remote = "https://github.com/synthetic/catalogs.git";
  const identity = normalizeRemoteRepository(remote);
  if (!identity?.profileFileName) throw new Error("Expected a synthetic repository identity");
  const repository = {
    directory: setup.cwd,
    originDirectory: identity.origin.directoryName,
    repositoryName: identity.profileFileName,
    ...(options.privateDelivery
      ? {
          privateSkillsDirectory: path.join(
            setup.home,
            ".shadowclone/builds/learning-fixture/skills",
          ),
        }
      : {}),
  };
  const directory = repository.privateSkillsDirectory ?? path.join(setup.cwd, ".agents/skills");
  const filePath = path.join(directory, "repository-types/SKILL.md");
  const text =
    "---\nname: repository-types\ndescription: Use when checking repository types.\n---\n# Repository types\n\nCheck repository exports.\n";
  await Bun.write(filePath, text);
  const [artifact] = setup.state.artifacts;
  const [record] = setup.state.records;
  if (!artifact || !record) throw new Error("Expected catalog fixtures");
  const scope = `${repository.originDirectory}/${repository.repositoryName}`;
  const state = {
    ...setup.state,
    repositories: [repository],
    records: [
      ...setup.state.records,
      {
        ...record,
        rule: {
          ...record.rule,
          key: "repository-task",
          scope: "project" as const,
          originDirectory: repository.originDirectory,
          repositoryName: repository.repositoryName,
        },
      },
    ],
    artifacts: [
      ...setup.state.artifacts,
      {
        ...artifact,
        filePath,
        scope,
        name: "repository-types",
        learningKeys: ["repository-task"],
        fingerprint: fingerprint(text),
      },
    ],
  };
  const config = await readConfig({ configPath: setup.paths.configFile });
  await writeConfig({
    configPath: setup.paths.configFile,
    config: {
      ...config,
      sources: { ...config.sources, "git-metadata": true },
    },
  });
  await writeEnvironment({ paths: setup.paths, state });
  return {
    ...setup,
    state,
    repository,
    repositorySkill: filePath,
    repositoryCatalog: path.join(directory, "shadowclone-guidance/catalog.md"),
  };
}
