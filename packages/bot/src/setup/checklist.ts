import { z } from "zod";
import { providerSecrets, type Clone, type Provider } from "../types";
import { readBotAccess } from "./account";
import type { GhApiCall } from "./ghApi";

export type ChecklistLink = { readonly label: string; readonly url: string };

export type ChecklistItem = {
  readonly key: "bot-token" | "provider-key" | "skills" | "workflows" | "invitation";
  readonly done: boolean;
  readonly title: string;
  readonly action: string;
  readonly links: readonly ChecklistLink[];
};

const environmentSchema = z.object({ id: z.number().int().positive() });
const secretsSchema = z.object({ secrets: z.array(z.object({ name: z.string() })) });

const providerKeys: Readonly<Record<Provider, { readonly title: string; readonly source: ChecklistLink | null }>> = {
  anthropic: {
    title: "Anthropic API key",
    source: { label: "Create the key in the Claude Console", url: "https://platform.claude.com/settings/keys" },
  },
  openai: {
    title: "OpenAI API key",
    source: { label: "Create the key on the OpenAI Platform", url: "https://platform.openai.com/api-keys" },
  },
  "openai-compatible": { title: "API key for the OpenAI-compatible provider", source: null },
  cursor: {
    title: "Cursor API key",
    source: { label: "Create the key in the Cursor dashboard", url: "https://cursor.com/dashboard" },
  },
};

export function botTokenPage(repository: string): string {
  const page = new URL("https://github.com/settings/tokens/new");

  page.searchParams.set("scopes", "repo");
  page.searchParams.set("description", `shadowclone ${repository}`);

  return page.toString();
}

export async function environmentState(options: {
  readonly call: GhApiCall;
  readonly repository: string;
}) {
  const environment = await options.call({
    route: `repos/${options.repository}/environments/shadowclone`,
  });

  if (environment.status !== 200) {
    return {
      page: `https://github.com/${options.repository}/settings/environments`,
      secrets: new Set<string>(),
    };
  }

  const secrets = await options.call({
    route: `repos/${options.repository}/environments/shadowclone/secrets?per_page=100`,
  });

  return {
    page: `https://github.com/${options.repository}/settings/environments/${environmentSchema.parse(environment.data).id}/edit`,
    secrets: new Set(
      secrets.status === 200
        ? secretsSchema.parse(secrets.data).secrets.map((secret) => secret.name)
        : [],
    ),
  };
}

export async function readCloudChecklist(options: {
  readonly call: GhApiCall;
  readonly clone: Clone;
  readonly pullUrl: string | null;
}): Promise<readonly ChecklistItem[]> {
  const { call, clone } = options;
  const environment = await environmentState({ call, repository: clone.repository });
  const environmentLink = { label: "Add it here", url: environment.page };
  const relay = await call({
    route: `repos/${clone.repository}/contents/.github/workflows/shadowclone-relay.yml?ref=${encodeURIComponent(clone.defaultBranch)}`,
  });
  const secret = providerSecrets[clone.provider];
  const key = providerKeys[clone.provider];
  const access = await readBotAccess({ call, repository: clone.repository, login: clone.botLogin });

  return [
    {
      key: "bot-token",
      done: environment.secrets.has("SHADOWCLONE_BOT_TOKEN"),
      title: `Token for ${clone.botLogin}`,
      action: `Sign in to GitHub as ${clone.botLogin}, create a classic token with only the repo scope, and add it as SHADOWCLONE_BOT_TOKEN.`,
      links: [{ label: "Create the token", url: botTokenPage(clone.repository) }, environmentLink],
    },
    {
      key: "provider-key",
      done: environment.secrets.has(secret),
      title: key.title,
      action: clone.provider === "openai-compatible"
        ? `Add the key for ${clone.baseUrl ?? "the provider"} as ${secret}. The endpoint must serve the OpenAI Responses API.`
        : `Add the key as ${secret}.`,
      links: [...(key.source ? [key.source] : []), environmentLink],
    },
    {
      key: "skills",
      done: environment.secrets.has("SHADOWCLONE_SKILLS_KEY"),
      title: `Skills from ${clone.skillsRepository}`,
      action: "Run shadowclone bot setup again to push the skills and add their deploy key.",
      links: [{ label: "Skills repository", url: `https://github.com/${clone.skillsRepository}` }],
    },
    {
      key: "workflows",
      done: relay.status === 200,
      title: `Workflows on ${clone.defaultBranch}`,
      action: "Review and merge the setup pull request.",
      links: options.pullUrl === null ? [] : [{ label: "Setup pull request", url: options.pullUrl }],
    },
    {
      key: "invitation",
      done: access === "collaborator",
      title: `${clone.botLogin} joined the repository`,
      action: access === "invited"
        ? "Run shadowclone bot status. Its check run accepts the invitation and confirms the API key."
        : "Run shadowclone bot setup again to invite the bot.",
      links: [],
    },
  ];
}
