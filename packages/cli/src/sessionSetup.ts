import { projectPaths } from "@shadowclone/core";
import {
  clonesPaths,
  githubThroughGh,
  hostProcesses,
  pushSessionSkills,
  setUpSessions,
  setupSummary,
  type SessionSetupOutcome,
} from "@shadowclone/clones";
import { currentRepository } from "./botSetup";
import { promptConfirmation } from "./confirm";

type SetupOptions = Omit<
  Parameters<typeof setUpSessions>[0],
  | "github"
  | "processes"
  | "paths"
  | "repository"
  | "approveRuleset"
  | "executable"
  | "pathVariable"
  | "environment"
> & {
  readonly repository: string | null;
  readonly yes: boolean;
};

export async function pushSkillsInTerminal(options: { readonly yes: boolean }): Promise<boolean> {
  const cwd = process.cwd();
  const first = await pushSessionSkills({ paths: projectPaths, cwd, approve: false });

  if (first.kind === "needs-approval") {
    console.log(
      `These ${first.files.length} files go to the private repository ${first.skillsRepository}:`,
    );
    console.log(first.files.map((file) => `  ${file.path} (${file.bytes} bytes)`).join("\n"));

    if (!options.yes && !promptConfirmation("Push them?")) {
      console.log("Nothing changed.");
      return false;
    }
  }

  const outcome =
    first.kind === "needs-approval"
      ? await pushSessionSkills({ paths: projectPaths, cwd, approve: true })
      : first;

  console.log(
    outcome.kind === "unchanged"
      ? `${outcome.skillsRepository} is up to date.`
      : `Pushed the skills to ${outcome.skillsRepository}.`,
  );

  if (outcome.leftOut.length > 0) {
    console.log(`Left out ${outcome.leftOut.join(", ")}: no copy exists on this machine.`);
  }

  return true;
}

function stopWith(message: string): void {
  console.log(message);
  process.exitCode = 1;
}

export async function setUpSessionsInTerminal(options: SetupOptions): Promise<void> {
  const { yes, ...request } = options;
  const repository = options.repository ?? (await currentRepository(process.cwd()));
  const executable = Bun.which("shadowclone") ?? "shadowclone";
  const setup = (approveRuleset: boolean): Promise<SessionSetupOutcome> =>
    setUpSessions({
      ...request,
      github: githubThroughGh,
      processes: hostProcesses,
      paths: clonesPaths(),
      repository,
      approveRuleset,
      executable,
      pathVariable: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
      environment: process.env,
    });
  let outcome = await setup(false);

  if (outcome.kind === "needs-skills") {
    console.log(
      `${outcome.skillsRepository} does not exist yet. Setup pushes your equipped skills there first.`,
    );

    if (!(await pushSkillsInTerminal({ yes }).catch(() => false))) {
      stopWith(
        "Run shadowclone session skills on the machine that has your skills, in the repository checkout. Then run setup again.",
      );
      return;
    }

    outcome = await setup(false);
  }

  if (outcome.kind === "needs-ruleset-approval") {
    console.log(outcome.summary);

    if (!yes && !promptConfirmation(`Add it to ${outcome.repository}?`)) {
      console.log(
        "Nothing changed. Sessions need this ruleset, because a session works with your own token.",
      );
      return;
    }

    outcome = await setup(true);
  }

  if (outcome.kind === "needs-docker") {
    stopWith(
      `Docker does not run on this machine: ${outcome.detail}\nInstall Docker Desktop, OrbStack, or Docker Engine, start it, and run setup again.`,
    );
    return;
  }

  if (outcome.kind === "needs-host-tool") {
    stopWith(outcome.detail);
    return;
  }

  if (outcome.kind === "needs-host-login") {
    stopWith(`Sign in first: ${outcome.command}\nThen run setup again.`);
    return;
  }

  if (outcome.kind !== "configured" && outcome.kind !== "configured-cloud") {
    stopWith("Setup did not finish. Run it again.");
    return;
  }

  console.log(setupSummary(outcome).join("\n"));
}
