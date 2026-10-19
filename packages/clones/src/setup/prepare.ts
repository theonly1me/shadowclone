import { z } from "zod";
import { githubData, type GithubCall } from "../github";
import {
  cloneConfigSchema,
  cloneConfigVersion,
  publicChatgptRefusal,
  type CloneConfig,
  type CloneConfigInput,
} from "../config/config";
import type { CloneProvider } from "../config/providers";
import { ensureSessionsRuleset, sessionsRulesetSummary } from "./ruleset";

export type SetupRequest = {
  readonly repository: string;
  readonly provider: CloneProvider;
  readonly baseUrl?: string;
  readonly model?: string;
  readonly image?: string;
  readonly attribution: boolean;
  readonly approveRuleset: boolean;
};

export type Preparation =
  | { readonly kind: "needs-skills"; readonly skillsRepository: string }
  | {
      readonly kind: "needs-ruleset-approval";
      readonly repository: string;
      readonly summary: string;
    }
  | { readonly kind: "ready"; readonly config: CloneConfig; readonly organization: boolean };

const userSchema = z.object({ id: z.number().int().positive(), login: z.string() });

const repositorySchema = z.object({
  id: z.number().int().positive(),
  full_name: z.string(),
  default_branch: z.string(),
  visibility: z.enum(["public", "private", "internal"]),
  owner: z.object({ type: z.string() }),
  permissions: z.object({ admin: z.boolean() }).optional(),
});

export const organizationWarning =
  "The ruleset applies to every member of the organization: each change to the default branch needs a pull request.";

export async function prepareClones(
  options: SetupRequest & { readonly github: GithubCall },
): Promise<Preparation> {
  const { github } = options;
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

  const input: CloneConfigInput = {
    version: cloneConfigVersion,
    repository: repository.full_name,
    repositoryId: repository.id,
    defaultBranch: repository.default_branch,
    visibility: repository.visibility,
    ownerId: owner.id,
    ownerLogin: owner.login,
    skillsRepository,
    provider: options.provider,
    attribution: options.attribution,
    ...(options.baseUrl === undefined ? {} : { baseUrl: options.baseUrl }),
    ...(options.model === undefined ? {} : { model: options.model }),
    ...(options.image === undefined ? {} : { image: options.image }),
  };
  const parsed = cloneConfigSchema.safeParse(input);

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

  await ensureSessionsRuleset({ github, repository: repository.full_name });

  return {
    kind: "ready",
    config: parsed.data,
    organization: repository.owner.type === "Organization",
  };
}
