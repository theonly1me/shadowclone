export const cloneProviders = [
  "claude-subscription",
  "anthropic",
  "chatgpt-subscription",
  "openai",
  "openai-compatible",
  "ollama",
  "foundry",
] as const;

export type CloneProvider = (typeof cloneProviders)[number];

export type CloneEngine = "claude" | "codex";

type ProviderLogin = {
  readonly engine: CloneEngine;
  readonly secret: string | null;
  readonly secretRequired: boolean;
  readonly endpoint: "none" | "https" | "http-or-https" | "foundry";
  readonly modelRequired: boolean;
  readonly reviews: boolean;
  readonly label: string;
};

export const providerLogins: Readonly<Record<CloneProvider, ProviderLogin>> = {
  "claude-subscription": {
    engine: "claude",
    secret: "CLAUDE_CODE_OAUTH_TOKEN",
    secretRequired: true,
    endpoint: "none",
    modelRequired: false,
    reviews: true,
    label: "the token that `claude setup-token` prints",
  },
  anthropic: {
    engine: "claude",
    secret: "ANTHROPIC_API_KEY",
    secretRequired: true,
    endpoint: "none",
    modelRequired: false,
    reviews: true,
    label: "an Anthropic API key",
  },
  "chatgpt-subscription": {
    engine: "codex",
    secret: null,
    secretRequired: false,
    endpoint: "none",
    modelRequired: false,
    reviews: true,
    label: "a ChatGPT plan login from `codex login --device-auth`",
  },
  openai: {
    engine: "codex",
    secret: "OPENAI_API_KEY",
    secretRequired: true,
    endpoint: "none",
    modelRequired: false,
    reviews: true,
    label: "an OpenAI API key",
  },
  "openai-compatible": {
    engine: "codex",
    secret: "OPENAI_COMPATIBLE_API_KEY",
    secretRequired: true,
    endpoint: "https",
    modelRequired: true,
    reviews: true,
    label: "the API key of the OpenAI-compatible endpoint",
  },
  ollama: {
    engine: "codex",
    secret: "OLLAMA_API_KEY",
    secretRequired: false,
    endpoint: "http-or-https",
    modelRequired: true,
    reviews: false,
    label: "an Ollama API key, only if the Ollama server needs one",
  },
  foundry: {
    engine: "codex",
    secret: "AZURE_OPENAI_API_KEY",
    secretRequired: true,
    endpoint: "foundry",
    modelRequired: true,
    reviews: false,
    label: "the Azure OpenAI key of the Foundry resource",
  },
};

export const githubTokenSecret = "GH_TOKEN";

export const agentCoauthors: Readonly<Record<CloneEngine, string>> = {
  claude: "Claude <noreply@anthropic.com>",
  codex: "Codex <noreply@openai.com>",
};
