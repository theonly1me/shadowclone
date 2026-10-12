import { expect, test } from "bun:test";
import { botCommand } from "./bot";
import { reviewStages } from "./reviewStages";

const setupUsage =
  "Use shadowclone bot setup --bot login [--provider anthropic|openai|openai-compatible|cursor] [--base-url https-url --model id] [--model id] [--repo owner/repository] [--yes] [--no-open].";

test("bot setup needs the bot's machine account and a known provider", async () => {
  await expect(botCommand(["setup", "--repo", "sample/project"])).rejects.toThrow(setupUsage);
  await expect(
    botCommand(["setup", "--bot", "sample-shadow", "--repo", "sample/project", "--provider", "gemini"]),
  ).rejects.toThrow(setupUsage);
  await expect(
    botCommand(["setup", "--bot", "sample-shadow", "--repo", "sample/project", "--app"]),
  ).rejects.toThrow(setupUsage);
});

test("bot setup for an OpenAI-compatible provider stops before GitHub when the base URL is missing or not https", async () => {
  await expect(botCommand([
    "setup", "--bot", "sample-shadow", "--repo", "sample/project", "--provider", "openai-compatible", "--model", "sample-model",
  ])).rejects.toThrow("An OpenAI-compatible provider needs an https base URL, and other providers take none.");
  await expect(botCommand([
    "setup", "--bot", "sample-shadow", "--repo", "sample/project", "--provider", "openai-compatible",
    "--base-url", "http://models.example.test/v1", "--model", "sample-model",
  ])).rejects.toThrow("The base URL must be an https URL with no query or credentials.");
});

test("review analyze accepts Cursor and takes a base URL only for Codex", async () => {
  const analyze = reviewStages.analyze;

  if (!analyze) {
    throw new Error("The analyze stage is missing.");
  }

  await expect(analyze(["--engine", "gemini"])).rejects.toThrow("Choose --engine claude, codex, or cursor.");
  await expect(analyze(["--engine", "claude", "--base-url", "https://models.example.test/v1"])).rejects.toThrow(
    "--base-url takes an https URL and works only with --engine codex.",
  );
  await expect(analyze(["--engine", "codex", "--base-url", "http://models.example.test/v1"])).rejects.toThrow(
    "--base-url takes an https URL and works only with --engine codex.",
  );
  await expect(analyze(["--engine", "cursor", "--network", "off"])).rejects.toThrow("--packet");
});
