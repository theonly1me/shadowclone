import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { GithubCall } from "../github";
import { prepareCodexHome } from "../run/codexHome";
import type { Processes } from "../run/processes";
import { cloneEngine, type CloneConfig } from "../config/config";
import { githubTokenSecret } from "../config/providers";

export const checkLineSchema = z.strictObject({
  name: z.string(),
  passed: z.boolean(),
  detail: z.string(),
});

export type CheckLine = z.infer<typeof checkLineSchema>;

const readyPrompt = "Reply with the single word ready.";

async function githubChecks(options: {
  readonly config: CloneConfig;
  readonly github: GithubCall;
  readonly environment: Readonly<Record<string, string | undefined>>;
}): Promise<readonly CheckLine[]> {
  const { config, github } = options;

  if ((options.environment[githubTokenSecret] ?? "") === "") {
    return [
      {
        name: "GitHub token",
        passed: false,
        detail: `${githubTokenSecret} is empty in the secrets file.`,
      },
    ];
  }

  const user = z.object({ id: z.number() }).safeParse((await github({ route: "user" })).data);
  const repository = await github({ route: `repos/${config.repository}` });
  const writable = z
    .object({ permissions: z.object({ push: z.boolean() }) })
    .safeParse(repository.data);
  const skills = await github({ route: `repos/${config.skillsRepository}` });

  return [
    {
      name: "GitHub token",
      passed: user.success && user.data.id === config.ownerId,
      detail:
        user.success && user.data.id === config.ownerId
          ? `The token acts as ${config.ownerLogin}.`
          : `The token does not belong to ${config.ownerLogin}.`,
    },
    {
      name: "Repository access",
      passed: writable.success && writable.data.permissions.push,
      detail:
        writable.success && writable.data.permissions.push
          ? `The token can push to ${config.repository}.`
          : `Give the token write access to the contents, issues, and pull requests of ${config.repository}.`,
    },
    {
      name: "Skills repository",
      passed: skills.status === 200,
      detail:
        skills.status === 200
          ? `The token reads ${config.skillsRepository}.`
          : `Add ${config.skillsRepository} to the repositories of the token.`,
    },
  ];
}

async function modelCheck(options: {
  readonly config: CloneConfig;
  readonly processes: Processes;
  readonly root: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
}): Promise<CheckLine> {
  const { config, processes, root } = options;
  const model = config.model === undefined ? [] : ["--model", config.model];

  if (cloneEngine(config) === "claude") {
    const result = await processes.run({
      arguments: ["claude", "-p", readyPrompt, ...model],
      cwd: root,
    });

    return {
      name: "Model login",
      passed: result.exitCode === 0,
      detail:
        result.exitCode === 0
          ? "Claude Code answered."
          : result.stderr.trim().slice(0, 300) || result.stdout.trim().slice(0, 300),
    };
  }

  const skills = path.join(root, "skills");

  await mkdir(path.join(skills, "plugins", "shadowclone-personal", "skills"), { recursive: true });
  await writeFile(path.join(skills, "native.md"), "");

  const home = await prepareCodexHome({
    config,
    processes,
    environment: options.environment,
    workspace: { root, repository: root, skills },
  });
  const result = await processes.run({
    arguments: ["codex", "exec", "--skip-git-repo-check", ...model, readyPrompt],
    cwd: root,
    environment: { CODEX_HOME: home },
  });

  return {
    name: "Model login",
    passed: result.exitCode === 0,
    detail: result.exitCode === 0 ? "Codex answered." : result.stderr.trim().slice(0, 300),
  };
}

export async function runContainerCheck(options: {
  readonly config: CloneConfig;
  readonly github: GithubCall;
  readonly processes: Processes;
  readonly root: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
}): Promise<readonly CheckLine[]> {
  const github = await githubChecks(options);

  return [...github, await modelCheck(options)];
}
