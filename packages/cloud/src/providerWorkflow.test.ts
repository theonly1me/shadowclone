import { expect, test } from "bun:test";
import { fixtureClone } from "./fixtures";
import { cloneSchema, type Clone } from "./types";
import { renderWorkflows } from "./workflow";

const openai: Clone = { ...fixtureClone, provider: "openai" };
const compatible: Clone = {
  ...fixtureClone,
  provider: "openai-compatible",
  baseUrl: "https://models.example.test/v1",
  model: "sample-model",
};
const cursor: Clone = { ...fixtureClone, provider: "cursor" };
const providerSecretNames = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "OPENAI_COMPATIBLE_API_KEY", "CURSOR_API_KEY"];

function worker(clone: Clone): string {
  return renderWorkflows(clone)[".github/workflows/shadowclone.yml"] ?? "";
}

function reviewAnalyze(clone: Clone): string {
  const rendered = worker(clone);

  return rendered.slice(rendered.indexOf("  review-analyze:"), rendered.indexOf("  review-publish:"));
}

test("each provider's workflows read only its own API key and no subscription login or App key", () => {
  const cases = [
    { clone: fixtureClone, secret: "ANTHROPIC_API_KEY" },
    { clone: openai, secret: "OPENAI_API_KEY" },
    { clone: compatible, secret: "OPENAI_COMPATIBLE_API_KEY" },
    { clone: cursor, secret: "CURSOR_API_KEY" },
  ];

  for (const { clone, secret } of cases) {
    const rendered = Object.values(renderWorkflows(clone)).join("\n");
    const secretsRead = new Set(rendered.match(/secrets\.[A-Z_]+/g));

    expect([...secretsRead].sort()).toEqual(
      ["secrets.SHADOWCLONE_BOT_TOKEN", "secrets.SHADOWCLONE_SKILLS_KEY", `secrets.${secret}`].sort(),
    );
    expect(providerSecretNames.filter((name) => name !== secret && rendered.includes(`secrets.${name}`))).toEqual([]);
  }
});

test("a Claude bot works through claude-code-action with the API key and the bot token", () => {
  const rendered = worker(fixtureClone);

  expect(rendered).toContain(`anthropic_api_key: \${{ secrets.ANTHROPIC_API_KEY }}`);
  expect(rendered).toContain(`github_token: \${{ secrets.SHADOWCLONE_BOT_TOKEN }}`);
  expect(rendered).toContain("trigger_phrase: '@sample-shadow'");
  expect(rendered).toContain("bot_id: '31'");
  expect(rendered).toContain("PATCH /user/repository_invitations/{invitation_id}");
  expect(reviewAnalyze(fixtureClone)).toContain("--engine claude");
});

test("an OpenAI bot signs in to Codex with the API key and uses the default OpenAI endpoint", () => {
  const rendered = worker(openai);

  expect(rendered).not.toContain("anthropics/claude-code-action");
  expect(rendered).toContain(`SHADOWCLONE_CODEX_KEY: \${{ secrets.OPENAI_API_KEY }}`);
  expect(rendered).toContain("printenv SHADOWCLONE_CODEX_KEY | codex login --with-api-key");
  expect(rendered).toContain('cp "$SHADOWCLONE_GUIDANCE_DIRECTORY/native.md" "$CODEX_HOME/AGENTS.md"');
  expect(rendered).not.toContain("openai_base_url");
  expect(reviewAnalyze(openai)).toContain("--engine codex");
  expect(reviewAnalyze(openai)).toContain("printenv SHADOWCLONE_CODEX_KEY | codex login --with-api-key");
});

test("an OpenAI-compatible bot sends Codex work and reviews to the configured base URL and model", () => {
  const rendered = worker(compatible);
  const endpoint = `-c 'openai_base_url="https://models.example.test/v1"' --model 'sample-model'`;

  expect(rendered).toContain(`SHADOWCLONE_CODEX_KEY: \${{ secrets.OPENAI_COMPATIBLE_API_KEY }}`);
  expect(rendered).toContain(`codex exec - --skip-git-repo-check --sandbox danger-full-access`);
  expect(rendered).toContain(endpoint);
  expect(reviewAnalyze(compatible)).toContain(
    "--engine codex --model 'sample-model' --base-url 'https://models.example.test/v1'",
  );
});

test("a Cursor bot installs the pinned Cursor CLI, checks its digest, and works with the Cursor key", () => {
  const rendered = worker(cursor);

  expect(rendered).toContain("downloads.cursor.com/lab/2026.10.01-e373342/linux/x64/agent-cli-package.tar.gz");
  expect(rendered).toContain(
    'echo "a79726c6e644520e993970be4c45775a6889802b67abe461a677a53219ae28e8  $RUNNER_TEMP/cursor.tar.gz" | sha256sum --check --quiet',
  );
  expect(rendered).toContain(`CURSOR_API_KEY: \${{ secrets.CURSOR_API_KEY }}`);
  expect(rendered).toContain("cursor-agent --print --force --trust --output-format text --workspace");
  expect(rendered).toContain('cp -R "$SHADOWCLONE_GUIDANCE_DIRECTORY/plugins/shadowclone-personal/skills/." "$HOME/.cursor/skills/"');
  expect(reviewAnalyze(cursor)).toContain("--engine cursor");
  expect(reviewAnalyze(cursor)).toContain(`CURSOR_API_KEY: \${{ secrets.CURSOR_API_KEY }}`);
});

test("a run lasts up to 3 hours, and its last step saves unfinished work unless the request is paused", () => {
  for (const clone of [fixtureClone, openai, cursor]) {
    const rendered = worker(clone);

    expect(rendered).toContain("timeout-minutes: 180");
    expect(rendered).toContain("timeout-minutes: 170");
    expect(rendered).toContain(
      "name: Save unfinished work to the branch\n        if: always() && steps.validate.outputs.allowed == 'true'",
    );
    expect(rendered).toContain("grep -qx 'shadowclone:paused'");
    expect(rendered).toContain("31+sample-shadow@users.noreply.github.com");
  }
});

test("every provider reads the skills from the private repository with a read-only key", () => {
  for (const clone of [fixtureClone, compatible, cursor]) {
    const rendered = worker(clone);

    expect(rendered).toContain("repository: 'sample/shadowclone-skills'");
    expect(rendered).toContain(`ssh-key: \${{ secrets.SHADOWCLONE_SKILLS_KEY }}`);
  }
});

test("only an OpenAI-compatible provider takes a base URL, and it must be https with a model", () => {
  expect(cloneSchema.safeParse(compatible).success).toBeTrue();
  expect(cloneSchema.safeParse({ ...compatible, baseUrl: "http://models.example.test/v1" }).success).toBeFalse();
  expect(cloneSchema.safeParse({ ...compatible, model: undefined }).success).toBeFalse();
  expect(cloneSchema.safeParse({ ...compatible, baseUrl: undefined }).success).toBeFalse();
  expect(cloneSchema.safeParse({ ...openai, baseUrl: "https://models.example.test/v1" }).success).toBeFalse();
  expect(cloneSchema.safeParse({ ...fixtureClone, identity: { kind: "app", appId: 20 } }).success).toBeFalse();
});
