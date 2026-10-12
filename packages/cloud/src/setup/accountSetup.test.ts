import { expect, test } from "bun:test";
import { guidanceFixture } from "../fixtures";
import { githubState } from "./accountFixture";
import { organizationMergeWarning, setUpAccountClone } from "./accountSetup";

test("setup opens the signup page when the bot account does not exist, and changes nothing", async () => {
  const fixture = await guidanceFixture();
  const github = githubState({ botExists: false });

  try {
    const outcome = await setUpAccountClone({
      ...fixture,
      repository: "sample/project",
      botLogin: "sample-shadow",
      approveSkills: true,
      provider: "anthropic",
      ...github,
    });

    expect(outcome).toEqual({
      kind: "needs-account",
      login: "sample-shadow",
      signupUrl: "https://github.com/signup",
    });
    expect(github.events).toEqual([]);
  } finally {
    await fixture.cleanup();
  }
});

test("setup lists the skill files and waits for approval before it writes anything", async () => {
  const fixture = await guidanceFixture();
  const github = githubState({ botExists: true });

  try {
    const outcome = await setUpAccountClone({
      ...fixture,
      repository: "sample/project",
      botLogin: "sample-shadow",
      approveSkills: false,
      provider: "anthropic",
      ...github,
    });

    expect(outcome.kind).toBe("needs-approval");
    expect(
      outcome.kind === "needs-approval" ? outcome.files.map((file) => file.path) : [],
    ).toContain("plugins/shadowclone-personal/skills/shadowclone-work/SKILL.md");
    expect(github.events).toEqual([]);
  } finally {
    await fixture.cleanup();
  }
});

test("an approved setup protects the branch first, keeps tokens off Shadowclone, and opens the setup pull request", async () => {
  const fixture = await guidanceFixture();
  const github = githubState({ botExists: true });

  try {
    const outcome = await setUpAccountClone({
      ...fixture,
      repository: "sample/project",
      botLogin: "sample-shadow",
      approveSkills: true,
      provider: "anthropic",
      ...github,
    });

    expect(github.events).toEqual([
      "protect default branch",
      "create skills repository",
      "push skills",
      "add deploy key",
      "set SHADOWCLONE_SKILLS_KEY",
      "invite bot",
      "open setup pull request",
    ]);
    expect(
      outcome.kind === "configured"
        ? [outcome.clone.provider, outcome.clone.botLogin, outcome.pullUrl, outcome.environmentUrl]
        : null,
    ).toEqual([
      "anthropic",
      "sample-shadow",
      "https://github.com/sample/project/pull/5",
      "https://github.com/sample/project/settings/environments/77/edit",
    ]);
  } finally {
    await fixture.cleanup();
  }
});

test("a machine account setup in an organization repository warns that write-role members can no longer merge alone", async () => {
  const fixture = await guidanceFixture();
  const github = githubState({ botExists: true, organization: true });

  try {
    const outcome = await setUpAccountClone({
      ...fixture,
      repository: "sample/project",
      botLogin: "sample-shadow",
      approveSkills: true,
      provider: "anthropic",
      ...github,
    });

    expect(outcome.kind === "configured" ? outcome.warnings : null).toEqual([organizationMergeWarning]);
  } finally {
    await fixture.cleanup();
  }
});

test("an OpenAI-compatible setup without a base URL stops before it writes anything", async () => {
  const fixture = await guidanceFixture();
  const github = githubState({ botExists: true });

  try {
    await expect(setUpAccountClone({
      ...fixture,
      repository: "sample/project",
      botLogin: "sample-shadow",
      approveSkills: true,
      provider: "openai-compatible",
      model: "sample-model",
      ...github,
    })).rejects.toThrow("An OpenAI-compatible provider needs an https base URL, and other providers take none.");
    expect(github.events).toEqual([]);
  } finally {
    await fixture.cleanup();
  }
});
