import { z } from "zod";
import { ownedDirectory } from "@shadowclone/core";
import { githubData, type GithubCall } from "../github";
import type { Processes } from "../run/processes";
import {
  publicChatgptRefusal,
  sessionConfigSchema,
  type SessionConfig,
  type SessionConfigInput,
} from "../session/config";
import type { SessionProvider } from "../session/providers";
import { saveSessionConfig, type ClonesPaths } from "../session/store";
import { installService, type ServiceOutcome } from "../serve/service";
import { ensureSessionsRuleset, sessionsRulesetSummary } from "./ruleset";
import { createSecretsFile, secretLines, type SecretLine } from "./secrets";

export type SessionSetupOutcome =
  | { readonly kind: "needs-docker"; readonly detail: string }
  | { readonly kind: "needs-skills"; readonly skillsRepository: string }
  | {
      readonly kind: "needs-ruleset-approval";
      readonly repository: string;
      readonly summary: string;
    }
  | {
      readonly kind: "configured";
      readonly config: SessionConfig;
      readonly secretsFile: string;
      readonly secretsFileCreated: boolean;
      readonly secrets: readonly SecretLine[];
      readonly service: ServiceOutcome;
      readonly imageReady: boolean;
      readonly warnings: readonly string[];
    };

const userSchema = z.object({ id: z.number().int().positive(), login: z.string() });

const repositorySchema = z.object({
  id: z.number().int().positive(),
  full_name: z.string(),
  default_branch: z.string(),
  visibility: z.enum(["public", "private", "internal"]),
  owner: z.object({ type: z.string() }),
  permissions: z.object({ admin: z.boolean() }).optional(),
});

export async function setUpSessions(options: {
  readonly github: GithubCall;
  readonly processes: Processes;
  readonly paths: ClonesPaths;
  readonly repository: string;
  readonly provider: SessionProvider;
  readonly baseUrl?: string;
  readonly model?: string;
  readonly image?: string;
  readonly attribution: boolean;
  readonly approveRuleset: boolean;
  readonly executable: string;
  readonly pathVariable: string;
}): Promise<SessionSetupOutcome> {
  const { github, processes, paths } = options;

  await ownedDirectory(paths.directory);

  const docker = await processes.run({
    arguments: ["docker", "info", "--format", "{{.ServerVersion}}"],
    cwd: paths.directory,
  });

  if (docker.exitCode !== 0) {
    return {
      kind: "needs-docker",
      detail: docker.stderr.trim().split("\n").at(-1) ?? "docker info failed.",
    };
  }

  const owner = userSchema.parse(await githubData({ github, route: "user" }));
  const repository = repositorySchema.parse(
    await githubData({ github, route: `repos/${options.repository}` }),
  );

  if (repository.permissions?.admin !== true) {
    throw new Error(
      `Setup needs administration access to ${repository.full_name}, to add the default branch ruleset.`,
    );
  }

  if (options.provider === "chatgpt-subscription" && repository.visibility === "public") {
    throw new Error(publicChatgptRefusal);
  }

  const skillsRepository = `${owner.login}/shadowclone-skills`;

  if ((await github({ route: `repos/${skillsRepository}` })).status === 404) {
    return { kind: "needs-skills", skillsRepository };
  }

  const input: SessionConfigInput = {
    version: 1,
    repository: repository.full_name,
    repositoryId: repository.id,
    defaultBranch: repository.default_branch,
    visibility: repository.visibility,
    ownerId: owner.id,
    ownerLogin: owner.login,
    skillsRepository,
    provider: options.provider,
    host: "local",
    attribution: options.attribution,
    ...(options.baseUrl === undefined ? {} : { baseUrl: options.baseUrl }),
    ...(options.model === undefined ? {} : { model: options.model }),
    ...(options.image === undefined ? {} : { image: options.image }),
  };
  const parsed = sessionConfigSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => issue.message).join(" "));
  }

  if (!options.approveRuleset) {
    return {
      kind: "needs-ruleset-approval",
      repository: repository.full_name,
      summary: sessionsRulesetSummary,
    };
  }

  const config = parsed.data;

  await ensureSessionsRuleset({ github, repository: repository.full_name });
  await saveSessionConfig({ paths, config });

  const secrets = secretLines(config);
  const created = await createSecretsFile({ paths, lines: secrets });
  const present = await processes.run({
    arguments: ["docker", "image", "inspect", config.image],
    cwd: paths.directory,
  });
  const imageReady =
    present.exitCode === 0 ||
    (
      await processes.run({
        arguments: ["docker", "pull", "--quiet", config.image],
        cwd: paths.directory,
      })
    ).exitCode === 0;
  const service = await installService({
    paths,
    processes,
    executable: options.executable,
    pathVariable: options.pathVariable,
  });

  return {
    kind: "configured",
    config,
    secretsFile: paths.secretsFile,
    secretsFileCreated: created === "created",
    secrets,
    service,
    imageReady,
    warnings: [
      ...(repository.owner.type === "Organization"
        ? [
            "The ruleset applies to every member of the organization: each change to the default branch needs a pull request.",
          ]
        : []),
      ...(imageReady
        ? []
        : [`Docker could not pull ${config.image}. Sessions cannot start until the image exists.`]),
    ],
  };
}
