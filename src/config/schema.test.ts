import { expect, test } from "bun:test";
import { parseConfig } from "./schema";

const coreSources = {
  "claude-code": true,
  "claude-prompts": true,
  codex: true,
  cursor: true,
  shell: true,
};

function config(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    "schema-version": 1,
    sources: coreSources,
    distillation: { deep: false },
    ...overrides,
  };
}

test("names the failing setting rather than the last check that ran", () => {
  expect(() =>
    parseConfig(config({ sources: { "claude-code": true, codex: true } })),
  ).toThrow("no unknown sources");

  expect(() =>
    parseConfig(config({ sources: { ...coreSources, invented: true } })),
  ).toThrow("no unknown sources");

  expect(() =>
    parseConfig(config({ sources: { ...coreSources, "claude-code": "yes" } })),
  ).toThrow("must be a boolean");

  expect(() => parseConfig(config({ distillation: {} }))).toThrow(
    "only the deep setting",
  );

  expect(() => parseConfig(config({ distillation: { deep: "yes" } }))).toThrow(
    "distillation.deep must be a boolean",
  );

  expect(() =>
    parseConfig(config({ distillation: { deep: false, extra: 1 } })),
  ).toThrow("only the deep setting");
});

test("separates an unsupported schema version from a missing one", () => {
  expect(() => parseConfig(config({ "schema-version": 2 }))).toThrow(
    "schema-version must be 1",
  );

  const withoutVersion = config({});
  delete withoutVersion["schema-version"];
  expect(() => parseConfig(withoutVersion)).toThrow(
    "only supported top-level settings",
  );

  expect(() => parseConfig(config({ invented: true }))).toThrow(
    "only supported top-level settings",
  );
});

test("defaults the sources an older config predates", () => {
  const parsed = parseConfig(config({}));
  expect(parsed.sources["agent-context"]).toBeFalse();
  expect(parsed.sources.antigravity).toBeFalse();
  expect(parsed.sources["git-metadata"]).toBeFalse();
  expect(parsed.sources.shell).toBeTrue();
});
