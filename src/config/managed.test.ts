import { expect, test } from "bun:test";
import {
  applyManagedPolicy,
  defaultConfig,
  defaultManagedPolicy,
  parseManagedPolicy,
} from "./index";

test("managed policy can only narrow user source consent", () => {
  const config = {
    ...defaultConfig,
    sources: {
      antigravity: true,
      "claude-code": true,
      "claude-prompts": true,
      codex: false,
      cursor: false,
      "git-metadata": true,
      shell: false,
    },
    distillation: { deep: true },
  };
  const policy = {
    ...defaultManagedPolicy,
    allowedSources: ["claude-code"] as const,
    distillation: "disabled" as const,
  };

  const effective = applyManagedPolicy({ config, policy });

  expect(effective.sources["claude-code"]).toBeTrue();
  expect(effective.sources.antigravity).toBeFalse();
  expect(effective.sources["claude-prompts"]).toBeFalse();
  expect(effective.sources["git-metadata"]).toBeFalse();
  expect(effective.distillation.deep).toBeFalse();
});

test("a disabled managed policy is a hard stop", () => {
  const config = {
    ...defaultConfig,
    sources: { ...defaultConfig.sources, "claude-code": true },
    distillation: { deep: true },
  };
  const effective = applyManagedPolicy({
    config,
    policy: { ...defaultManagedPolicy, enabled: false },
  });

  expect(Object.values(effective.sources).every((enabled) => !enabled)).toBeTrue();
  expect(effective.distillation.deep).toBeFalse();
});

test("rejects unknown engines in managed policy", () => {
  expect(() =>
    parseManagedPolicy({
      enabled: true,
      allowedSources: ["claude-code"],
      allowedEngines: ["unknown"],
      distillation: "allowed",
      originScope: "strict",
      blockedOrigins: [],
      maxActionTier: "draft",
    })
  ).toThrow("invalid or missing fields");
});
