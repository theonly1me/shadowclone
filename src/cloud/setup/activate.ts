import { z } from "zod";
import type { BuildContext } from "../../builds/types";
import { readEffectiveConfig } from "../../config";
import { exportGuidance } from "../export";
import { cloneSchema, type Delivery, type Repository } from "../types";
import { saveInstallation } from "../status";
import { verifyInstallation } from "./installation";
import { configureEnvironment } from "./environment";
import { protectDefaultBranch } from "./ruleset";
import { createSetupPull } from "./pull";
import type { App } from "./app";
import type { GhCommand, GithubApi } from "./github";

export type ReviewedSetup = {
  readonly id: string;
  readonly repository: Repository;
  readonly owner: string;
  readonly name: string;
  readonly skills: readonly string[];
  readonly delivery: Delivery;
};

export async function activateClone(
  options: BuildContext & {
    readonly preview: ReviewedSetup;
    readonly app: App;
    readonly token: string;
    readonly command: GhCommand;
    readonly api: GithubApi;
  },
): Promise<string> {
  const { preview, app, command, api } = options;
  const { policy } = await readEffectiveConfig({
    configPath: options.paths.configFile,
    managedConfigPath: options.paths.managedConfigFile,
  });

  if (
    !policy.enabled ||
    !policy.allowedEngines.includes("claude-code") ||
    policy.maxActionTier !== "act"
  ) {
    throw new Error("Managed policy does not permit a Claude cloud clone with repository writes.");
  }

  const current = await exportGuidance({ ...options, skills: preview.skills });

  if (current.fingerprint !== preview.delivery.fingerprint) {
    throw new Error("The selected guidance changed. Review a fresh preview before uploading.");
  }

  const installation = await verifyInstallation({
    app,
    repository: preview.repository,
    api,
  });
  const bot = z
    .object({
      id: z.number().int().positive(),
      login: z.string(),
      type: z.literal("Bot"),
    })
    .parse(
      await api({
        route: `GET /users/${encodeURIComponent(`${app.slug}[bot]`)}`,
        token: installation.token,
      }),
    );
  const clone = cloneSchema.parse({
    repositoryId: preview.repository.id,
    repository: preview.repository.full_name,
    defaultBranch: preview.repository.default_branch,
    owner: preview.owner,
    appId: app.id,
    botId: bot.id,
    botLogin: bot.login,
    requesters: [preview.owner],
    reviewerBots: ["coderabbitai[bot]", "github-actions[bot]"],
    maximumRuns: 10,
  });

  await protectDefaultBranch({ repository: preview.repository, command });

  await configureEnvironment({
    repository: preview.repository,
    command,
    secrets: {
      SHADOWCLONE_APP_PRIVATE_KEY: app.pem,
      CLAUDE_CODE_OAUTH_TOKEN: options.token,
      SHADOWCLONE_GUIDANCE: current.encoded,
    },
  });

  const pullUrl = await createSetupPull({
    clone,
    token: installation.token,
    api,
  });

  await saveInstallation({
    paths: options.paths,
    installation: {
      clone,
      pullUrl,
      guidanceFingerprint: current.fingerprint,
      installedAt: new Date().toISOString(),
    },
  });

  return pullUrl;
}
