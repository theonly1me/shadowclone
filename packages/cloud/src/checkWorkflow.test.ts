import { expect, test } from "bun:test";
import { checkWorkflowPath } from "./checkWorkflow";
import { fixtureClone } from "./fixtures";
import type { Clone } from "./types";
import { renderWorkflows } from "./workflow";

function check(clone: Clone): string {
  return renderWorkflows(clone)[checkWorkflowPath] ?? "";
}

test("the check run starts only by dispatch, accepts the invitation, and reads the repository as the bot", () => {
  const rendered = check(fixtureClone);

  expect(rendered).toContain("on:\n  workflow_dispatch:\npermissions:\n  contents: read\n");
  expect(rendered).toContain("environment: shadowclone");
  expect(rendered).toContain("if: github.repository_id == '10'");
  expect(rendered).toContain("PATCH /user/repository_invitations/{invitation_id}");
  expect(rendered).toContain("gh api 'repos/sample/project' --jq .full_name");
});

test("the check run confirms each provider key with a request that the key must authorize", () => {
  expect(check(fixtureClone)).toContain(
    `curl -fsS https://api.anthropic.com/v1/models -H "x-api-key: $PROVIDER_KEY"`,
  );
  expect(check({ ...fixtureClone, provider: "openai" })).toContain(
    `curl -fsS https://api.openai.com/v1/models -H "Authorization: Bearer $PROVIDER_KEY"`,
  );
  expect(check({
    ...fixtureClone,
    provider: "openai-compatible",
    baseUrl: "https://models.example.test/v1",
    model: "sample-model",
  })).toContain(`curl -fsS 'https://models.example.test/v1/models' -H "Authorization: Bearer $PROVIDER_KEY"`);

  const cursor = check({ ...fixtureClone, provider: "cursor" });

  expect(cursor.indexOf("Install the Cursor CLI")).toBeGreaterThan(0);
  expect(cursor.indexOf("Install the Cursor CLI")).toBeLessThan(cursor.indexOf("Use the cursor API key"));
  expect(cursor).toContain(`CURSOR_API_KEY="$PROVIDER_KEY" cursor-agent --print --trust`);
});
