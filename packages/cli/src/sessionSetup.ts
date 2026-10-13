import { projectPaths } from "@shadowclone/core";
import {
  clonesPaths,
  githubThroughGh,
  hostProcesses,
  pushSessionSkills,
  setUpSessions,
  type SessionProvider,
} from "@shadowclone/clones";
import { currentRepository } from "./botSetup";
import { promptConfirmation } from "./confirm";

export async function setUpSessionsInTerminal(options: {
  readonly repository: string | null;
  readonly provider: SessionProvider;
  readonly baseUrl?: string;
  readonly model?: string;
  readonly attribution: boolean;
  readonly yes: boolean;
}): Promise<void> {
  const repository = options.repository ?? (await currentRepository(process.cwd()));
  const executable = Bun.which("shadowclone");

  if (executable === null) {
    throw new Error(
      "Install the shadowclone CLI on this machine with npm install -g @shadowclone/cli, then run setup again.",
    );
  }

  const setup = (approveRuleset: boolean) =>
    setUpSessions({
      github: githubThroughGh,
      processes: hostProcesses,
      paths: clonesPaths(),
      repository,
      provider: options.provider,
      ...(options.baseUrl === undefined ? {} : { baseUrl: options.baseUrl }),
      ...(options.model === undefined ? {} : { model: options.model }),
      attribution: options.attribution,
      approveRuleset,
      executable,
      pathVariable: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
    });
  const first = await setup(false);

  if (first.kind === "needs-docker") {
    console.log(
      `Docker does not run on this machine: ${first.detail}\nInstall Docker Desktop, OrbStack, or Docker Engine, start it, and run setup again.`,
    );
    process.exitCode = 1;
    return;
  }

  if (first.kind === "needs-skills") {
    console.log(
      `${first.skillsRepository} does not exist yet. On your main machine, run shadowclone session skills in the repository checkout. Then run setup here again.`,
    );
    process.exitCode = 1;
    return;
  }

  if (first.kind === "needs-ruleset-approval") {
    console.log(first.summary);

    if (!options.yes && !promptConfirmation(`Add it to ${first.repository}?`)) {
      console.log(
        "Nothing changed. Sessions need this ruleset, because a session works with your own token.",
      );
      return;
    }
  }

  const outcome = first.kind === "configured" ? first : await setup(true);

  if (outcome.kind !== "configured") {
    throw new Error("Setup did not finish. Run it again.");
  }

  console.log(
    `Cloud sessions are set up for ${outcome.config.repository} with ${outcome.config.provider}.`,
  );
  console.log(
    `\n1. Paste these values into ${outcome.secretsFile}${outcome.secretsFileCreated ? "" : " (the file exists, so add any missing line)"}:`,
  );
  console.log(
    outcome.secrets
      .map((line) => `   ${line.name}: ${line.description}${line.required ? "" : " (optional)"}`)
      .join("\n"),
  );

  if (outcome.config.provider === "chatgpt-subscription") {
    console.log(
      `2. Run shadowclone session login --repo ${outcome.config.repository}, and enter the code on chatgpt.com.`,
    );
  }

  console.log(
    `${outcome.config.provider === "chatgpt-subscription" ? 3 : 2}. Run shadowclone session status --repo ${outcome.config.repository}.`,
  );
  console.log(
    `\nThen comment /shadowclone <task> on an issue or pull request in ${outcome.config.repository}.`,
  );
  console.log(
    outcome.service.kind === "installed"
      ? `shadowclone serve runs as a service: ${outcome.service.file}`
      : outcome.service.kind === "failed"
        ? `The service did not start (${outcome.service.detail}). Run shadowclone serve in a terminal that stays open.`
        : `This platform (${outcome.service.platform}) has no service support. Run shadowclone serve in a terminal that stays open.`,
  );

  for (const warning of [
    ...outcome.warnings,
    ...(outcome.service.kind === "installed" ? outcome.service.warnings : []),
  ]) {
    console.log(`Note: ${warning}`);
  }
}

export async function pushSkillsInTerminal(options: { readonly yes: boolean }): Promise<void> {
  const cwd = process.cwd();
  const first = await pushSessionSkills({ paths: projectPaths, cwd, approve: false });

  if (first.kind === "needs-approval") {
    console.log(
      `These ${first.files.length} files go to the private repository ${first.skillsRepository}:`,
    );
    console.log(first.files.map((file) => `  ${file.path} (${file.bytes} bytes)`).join("\n"));

    if (!options.yes && !promptConfirmation("Push them?")) {
      console.log("Nothing changed.");
      return;
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
}
