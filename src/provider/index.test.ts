import { expect, test } from "bun:test";
import {
  getProvider,
  getProviderByEngine,
  getProviderSupport,
  providerDefinitions,
  providerIds,
  providerSupportsPurpose,
} from "./index";

test("registers every provider exactly once", () => {
  const registeredIds = providerDefinitions.map(
    (definition) => definition.id,
  );

  expect(new Set(registeredIds).size).toBe(providerIds.length);
  expect(registeredIds).toEqual([...providerIds]);
});

test("keeps observation and engine support independent", () => {
  const antigravity = getProvider("antigravity");

  expect(getProviderSupport(antigravity)).toEqual({
    observe: true,
    distill: false,
    dispatch: false,
  });
  expect(antigravity.engine?.implemented).toBeFalse();
  expect(antigravity.engine?.capabilities.isolatedNoTools).toBeFalse();
});

test("derives purpose support from enforceable capabilities", () => {
  const claude = getProvider("claude-code");
  const codex = getProvider("codex");
  const cursor = getProvider("cursor");

  expect(
    providerSupportsPurpose({ definition: claude, purpose: "dispatch" }),
  ).toBeTrue();
  expect(
    providerSupportsPurpose({ definition: codex, purpose: "distill" }),
  ).toBeTrue();
  expect(
    providerSupportsPurpose({ definition: codex, purpose: "dispatch" }),
  ).toBeFalse();
  expect(
    providerSupportsPurpose({ definition: cursor, purpose: "distill" }),
  ).toBeTrue();
});

test("does not make dispatch depend on distillation support", () => {
  const antigravity = getProvider("antigravity");
  const dispatchOnly = {
    ...antigravity,
    engine: {
      id: "antigravity" as const,
      implemented: true,
      capabilities: {
        structuredOutput: "none" as const,
        callerSessionId: true,
        maxBudgetUsd: true,
        granularToolPolicy: true,
        isolatedNoTools: false,
      },
    },
  };

  expect(getProviderSupport(dispatchOnly)).toEqual({
    observe: true,
    distill: false,
    dispatch: true,
  });
});

test("maps implemented engines to their provider", () => {
  expect(getProviderByEngine("claude-code")?.id).toBe("claude-code");
  expect(getProviderByEngine("codex")?.id).toBe("codex");
  expect(getProviderByEngine("cursor-agent")?.id).toBe("cursor");
  expect(getProviderByEngine("openai-compatible")).toBeNull();
});
