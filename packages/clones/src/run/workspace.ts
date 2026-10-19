import { chmod, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CloneConfig } from "../config/config";
import { agentCoauthors } from "../config/providers";
import { cloneEngine } from "../config/config";
import type { ResolvedClone } from "./resolve";
import { mustRun, type Processes } from "./processes";

export type Workspace = {
  readonly root: string;
  readonly repository: string;
  readonly skills: string;
};

export function ownerEmail(config: CloneConfig): string {
  return `${config.ownerId}+${config.ownerLogin}@users.noreply.github.com`;
}

function quoted(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function prePushHook(defaultBranch: string): string {
  return [
    "#!/bin/sh",
    "while read -r local_ref local_sha remote_ref remote_sha; do",
    `  if [ "$remote_ref" = ${quoted(`refs/heads/${defaultBranch}`)} ]; then`,
    `    echo ${quoted(`shadowclone: a clone never pushes to ${defaultBranch}. Push to the clone branch and open a pull request.`)} >&2`,
    "    exit 1",
    "  fi",
    "done",
    "exit 0",
    "",
  ].join("\n");
}

export function commitMessageHook(coauthor: string): string {
  return [
    "#!/bin/sh",
    `exec git interpret-trailers --in-place --if-exists addIfDifferent --trailer ${quoted(`Co-authored-by: ${coauthor}`)} "$1"`,
    "",
  ].join("\n");
}

async function installHook(options: {
  readonly repository: string;
  readonly name: string;
  readonly content: string;
}): Promise<void> {
  const file = path.join(options.repository, ".git", "hooks", options.name);

  await writeFile(file, options.content);
  await chmod(file, 0o755);
}

async function checkoutBranch(options: {
  readonly processes: Processes;
  readonly repository: string;
  readonly branch: string;
}): Promise<void> {
  const { processes, repository, branch } = options;
  const remote = await processes.run({
    arguments: ["git", "ls-remote", "--exit-code", "--heads", "origin", branch],
    cwd: repository,
  });

  if (remote.exitCode === 0) {
    await mustRun({
      processes,
      arguments: [
        "git",
        "fetch",
        "--no-tags",
        "origin",
        `+refs/heads/${branch}:refs/remotes/origin/${branch}`,
      ],
      cwd: repository,
    });
    await mustRun({
      processes,
      arguments: ["git", "checkout", "-B", branch, `origin/${branch}`],
      cwd: repository,
    });
    return;
  }

  await mustRun({ processes, arguments: ["git", "checkout", "-b", branch], cwd: repository });
}

export async function prepareWorkspace(options: {
  readonly config: CloneConfig;
  readonly clone: ResolvedClone;
  readonly processes: Processes;
  readonly root: string;
}): Promise<Workspace> {
  const { config, clone, processes, root } = options;
  const repository = path.join(root, "repository");
  const skills = path.join(root, "skills");

  await mustRun({ processes, arguments: ["gh", "auth", "setup-git"], cwd: root });
  await mustRun({
    processes,
    arguments: [
      "git",
      "clone",
      "--no-tags",
      `https://github.com/${config.repository}.git`,
      repository,
    ],
    cwd: root,
  });
  await mustRun({
    processes,
    arguments: [
      "git",
      "clone",
      "--depth",
      "1",
      "--no-tags",
      `https://github.com/${config.skillsRepository}.git`,
      skills,
    ],
    cwd: root,
  });
  await mustRun({
    processes,
    arguments: ["git", "config", "user.name", config.ownerLogin],
    cwd: repository,
  });
  await mustRun({
    processes,
    arguments: ["git", "config", "user.email", ownerEmail(config)],
    cwd: repository,
  });
  await installHook({ repository, name: "pre-push", content: prePushHook(config.defaultBranch) });

  if (config.attribution) {
    await installHook({
      repository,
      name: "commit-msg",
      content: commitMessageHook(agentCoauthors[cloneEngine(config)]),
    });
  }

  if (clone.kind !== "review") {
    await checkoutBranch({ processes, repository, branch: clone.branch });
  }

  return { root, repository, skills };
}
