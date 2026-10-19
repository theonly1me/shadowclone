import { describe, expect, test } from "bun:test";
import { cloneConfigSchema } from "./config";

const base = {
  version: 2,
  repository: "sample/project",
  repositoryId: 7,
  defaultBranch: "main",
  visibility: "private",
  ownerId: 11,
  ownerLogin: "sample",
  skillsRepository: "sample/shadowclone-skills",
} as const;

function issues(input: Record<string, unknown>): readonly string[] {
  const parsed = cloneConfigSchema.safeParse({ ...base, ...input });

  return parsed.success ? [] : parsed.error.issues.map((issue) => issue.message);
}

describe("clone config", () => {
  test("a ChatGPT plan login on a public repository is refused with OpenAI's reason", () => {
    expect(issues({ provider: "chatgpt-subscription", visibility: "public" })).toEqual([
      expect.stringContaining(
        "OpenAI says not to use a ChatGPT plan login for automation on a public repository",
      ),
    ]);
    expect(issues({ provider: "chatgpt-subscription" })).toEqual([]);
  });

  test("Ollama accepts a local http server, and Foundry needs its Azure v1 endpoint", () => {
    expect(
      issues({
        provider: "ollama",
        baseUrl: "http://host.docker.internal:11434/v1",
        model: "gpt-oss:20b",
      }),
    ).toEqual([]);
    expect(
      issues({
        provider: "foundry",
        baseUrl: "https://sample.openai.azure.com/openai/v1",
        model: "gpt-6",
      }),
    ).toEqual([]);
    expect(
      issues({ provider: "foundry", baseUrl: "https://example.com/v1", model: "gpt-6" }),
    ).toHaveLength(1);
  });

  test("a subscription login takes no base URL, and an endpoint provider needs a model", () => {
    expect(
      issues({ provider: "claude-subscription", baseUrl: "https://example.com" }),
    ).toHaveLength(1);
    expect(issues({ provider: "openai-compatible", baseUrl: "https://example.com/v1" })).toEqual([
      "The openai-compatible provider needs a model name.",
    ]);
  });

  test("the defaults turn the trailer on, use the clone image of this version, and allow 20 clones a day", () => {
    const parsed = cloneConfigSchema.parse({ ...base, provider: "anthropic" });

    expect(parsed.attribution).toBe(true);
    expect(parsed.image).toMatch(/^ghcr\.io\/theonly1me\/shadowclone-clone:\d+\.\d+\.\d+$/);
    expect(parsed.dailyClones).toBe(20);
  });

  test("a config with a cloud host from an earlier version does not parse", () => {
    expect(issues({ provider: "anthropic", host: "cloudflare" })).toHaveLength(1);
  });
});
