import path from "node:path";
import { canonicalPath, projectPaths, readEffectiveConfig } from "@shadowclone/core";
import { readEnvironment, registerWorkingRepository } from "@shadowclone/environment";

const usage = "Use learning repositories set <directory> --private|--repository";

export async function setRepositoryDelivery(arguments_: readonly string[]): Promise<void> {
  const [directory, choice, ...extra] = arguments_;

  if (!directory || (choice !== "--private" && choice !== "--repository") || extra.length > 0) {
    throw new Error(usage);
  }

  const { config, policy } = await readEffectiveConfig();

  if (!config.sources["skill-library"] || !policy.allowedSources.includes("skill-library")) {
    throw new Error("Enable skill maintenance before you choose where repository learnings go");
  }

  if (!config.sources["git-metadata"] || !policy.allowedSources.includes("git-metadata")) {
    throw new Error("Enable repository metadata consent so Shadowclone can identify this repository");
  }

  const workingDirectory = canonicalPath(path.resolve(directory));
  const state = await readEnvironment(projectPaths);

  if (state === null) {
    throw new Error("Run shadowclone migrate skills before you choose where repository learnings go");
  }

  const existing = state.repositories.find((repository) => repository.directory === workingDirectory);

  if (existing) {
    throw new Error(`${workingDirectory} already receives learnings ${existing.privateSkillsDirectory ? `privately in ${existing.privateSkillsDirectory}` : "in its own skill folders"}. Changing this choice is not supported yet.`);
  }

  const registered = await registerWorkingRepository({
    paths: projectPaths,
    workingDirectory,
    gitMetadataEnabled: true,
    blockedOrigins: policy.blockedOrigins,
    delivery: choice === "--private" ? "private" : "repository",
  });

  if (registered === null) {
    throw new Error(`Shadowclone cannot verify the Git remote of ${workingDirectory}, or managed policy blocks it. Nothing changed.`);
  }

  console.log(registered.privateSkillsDirectory
    ? `Learnings for ${workingDirectory} stay private in ${registered.privateSkillsDirectory}. No repository file changes. They publish at the next learning run.`
    : `Learnings for ${workingDirectory} publish into its .agents/skills and .claude/skills folders at the next learning run.`);
}
