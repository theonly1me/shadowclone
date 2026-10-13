import { projectPaths } from "@shadowclone/core";
import {
  ghApiCall,
  nextStepsText,
  openPage,
  type Provider,
  runGh,
  setUpAccountClone,
} from "@shadowclone/cloud";
import { promptConfirmation } from "./confirm";

async function currentRepository(cwd: string): Promise<string> {
  const child = Bun.spawn(
    ["gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"],
    { cwd, stdout: "pipe", stderr: "ignore" },
  );
  const output = (await new Response(child.stdout).text()).trim();

  if ((await child.exited) !== 0 || !/^[\w.-]+\/[\w.-]+$/.test(output)) {
    throw new Error(
      "Run setup in a GitHub repository checkout, or name it with --repo owner/repository.",
    );
  }

  return output;
}

export async function setUpBotInTerminal(options: {
  readonly repository: string | null;
  readonly botLogin: string;
  readonly provider: Provider;
  readonly baseUrl?: string;
  readonly model?: string;
  readonly yes: boolean;
  readonly open: boolean;
}): Promise<void> {
  const cwd = process.cwd();
  const repository = options.repository ?? (await currentRepository(cwd));
  const setup = (approveSkills: boolean) =>
    setUpAccountClone({
      paths: projectPaths,
      cwd,
      repository,
      botLogin: options.botLogin,
      approveSkills,
      provider: options.provider,
      ...(options.baseUrl === undefined ? {} : { baseUrl: options.baseUrl }),
      ...(options.model === undefined ? {} : { model: options.model }),
      call: ghApiCall,
      command: runGh,
    });
  const first = await setup(false);

  if (first.kind === "needs-account") {
    console.log(`Create the GitHub account ${first.login} for the bot, then run this command again: ${first.signupUrl}`);

    if (options.open) {
      await openPage(first.signupUrl);
    }

    return;
  }

  if (first.kind === "needs-approval") {
    for (const warning of first.warnings) {
      console.log(warning);
    }

    console.log(`Setup pushes these ${first.files.length} files to the private repository ${first.skillsRepository}:`);
    console.log(first.files.map((file) => `  ${file.path} (${file.bytes} bytes)`).join("\n"));

    if (!options.yes && !promptConfirmation("Push them?")) {
      console.log("Nothing changed.");
      return;
    }
  }

  const outcome = first.kind === "configured" ? first : await setup(true);

  if (outcome.kind !== "configured") {
    throw new Error("Setup stopped before it configured the repository. Run it again.");
  }

  console.log([
    ...outcome.warnings,
    nextStepsText({ repository, environmentUrl: outcome.environmentUrl, pullUrl: outcome.pullUrl, checklist: outcome.checklist }),
  ].join("\n\n"));

  if (options.open) {
    await openPage(outcome.environmentUrl);
  }
}
