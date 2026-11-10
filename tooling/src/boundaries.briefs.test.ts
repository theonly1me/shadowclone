import { expect, test } from "bun:test";
import { findViolations } from "./boundaries/check";
import type { ManifestIndex } from "./boundaries/manifests";
import { edgesOf, manifestOf } from "./boundaries/testing";

const everyPackage = ["core", "redact", "agents", "live", "mcp", "briefs"].map(
  (key) => `@shadowclone/${key}`,
);

const manifests: ManifestIndex = new Map([
  manifestOf({ key: "core" }),
  manifestOf({ key: "redact" }),
  manifestOf({ key: "agents" }),
  manifestOf({ key: "mcp" }),
  manifestOf({ key: "live", workspaceDependencies: everyPackage }),
  manifestOf({ key: "briefs", workspaceDependencies: everyPackage }),
]);

function messagesFor(files: Record<string, string>) {
  return findViolations({ edges: edgesOf(files), manifests }).map((violation) => violation.message);
}

test("briefs imports live, agents, core, and redact, and nothing above them", () => {
  expect(
    messagesFor({
      "packages/briefs/src/a.ts": [
        'import { a } from "@shadowclone/core";',
        'import { b } from "@shadowclone/redact";',
        'import { c } from "@shadowclone/agents";',
        'import { d } from "@shadowclone/live";',
      ].join("\n"),
    }),
  ).toEqual([]);
  expect(messagesFor({ "packages/briefs/src/a.ts": 'import { x } from "@shadowclone/mcp";' })).toEqual([
    '"@shadowclone/mcp" makes briefs depend on mcp',
  ]);
});

test("live cannot import briefs or agents", () => {
  expect(
    messagesFor({
      "packages/live/src/a.ts": 'import { x } from "@shadowclone/briefs";',
      "packages/live/src/b.ts": 'import { y } from "@shadowclone/agents";',
    }),
  ).toEqual(['"@shadowclone/briefs" makes live depend on briefs', '"@shadowclone/agents" makes live depend on agents']);
});
