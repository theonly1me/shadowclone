import path from "node:path";
import { canonicalPath, projectPaths } from "@shadowclone/core";
import {
  checkText,
  cloneStatus,
  exportGuidance,
  ghApiCall,
  providers,
  readInstallation,
  runCloneCheck,
  writeDeliveryFiles,
} from "@shadowclone/bot";
import { setUpBotInTerminal } from "./botSetup";

const setupSyntax =
  "shadowclone bot setup --bot login [--provider anthropic|openai|openai-compatible|cursor] [--base-url https-url --model id] [--model id] [--repo owner/repository] [--yes] [--no-open]";
const setupUsage = `Use ${setupSyntax}.`;

function flagValue(options: { readonly arguments: readonly string[]; readonly flag: string }): string | null {
  const index = options.arguments.indexOf(options.flag);

  return index < 0 ? null : (options.arguments[index + 1] ?? "");
}

async function setup(arguments_: readonly string[]): Promise<void> {
  const repository = flagValue({ arguments: arguments_, flag: "--repo" });
  const botLogin = flagValue({ arguments: arguments_, flag: "--bot" });
  const provider = providers.find((entry) => entry === (flagValue({ arguments: arguments_, flag: "--provider" }) ?? "anthropic"));
  const baseUrl = flagValue({ arguments: arguments_, flag: "--base-url" });
  const model = flagValue({ arguments: arguments_, flag: "--model" });
  const known = new Set(["--yes", "--no-open", "--repo", "--bot", "--provider", "--base-url", "--model"]);
  const values = new Set([repository, botLogin, provider, baseUrl, model]);

  if (
    botLogin === null ||
    provider === undefined ||
    (repository !== null && !/^[\w.-]+\/[\w.-]+$/.test(repository)) ||
    !/^[A-Za-z0-9-]{1,39}$/.test(botLogin) ||
    arguments_.some((argument) => !known.has(argument) && !values.has(argument))
  ) {
    throw new Error(setupUsage);
  }

  await setUpBotInTerminal({
    repository,
    botLogin,
    provider,
    ...(baseUrl === null ? {} : { baseUrl }),
    ...(model === null ? {} : { model }),
    yes: arguments_.includes("--yes"),
    open: !arguments_.includes("--no-open"),
  });
}

async function status(arguments_: readonly string[]): Promise<void> {
  const repository = flagValue({ arguments: arguments_, flag: "--repo" });

  if (repository === null) {
    console.log(JSON.stringify(await cloneStatus(projectPaths), null, 2));
    return;
  }

  const installation = await readInstallation({ paths: projectPaths, repository });

  if (installation === null) {
    throw new Error(`No Actions bot setup is saved for ${repository}. Run shadowclone bot setup first.`);
  }

  const check = await runCloneCheck({
    clone: installation.clone,
    call: ghApiCall,
    pullUrl: installation.pullUrl,
    limitMilliseconds: 8 * 60_000,
  });

  console.log(checkText(check));

  if (check.kind !== "passed") {
    process.exitCode = 1;
  }
}

async function exportSkills(arguments_: readonly string[]): Promise<void> {
  const skills: string[] = [];
  let destination: string | null = null;

  for (let position = 0; position < arguments_.length; position += 2) {
    const flag = arguments_[position];
    const value = arguments_[position + 1];

    if (!value || !["--skill", "--output"].includes(flag ?? "")) {
      throw new Error("Use shadowclone bot export --skill shadowclone-work [--skill name] --output folder.");
    }

    if (flag === "--skill") {
      skills.push(value);
    }

    if (flag === "--output") {
      destination = value;
    }
  }

  if (!destination) {
    throw new Error("Choose a private output folder outside the repository checkout.");
  }

  const cwd = canonicalPath(process.cwd());
  const output = canonicalPath(destination);
  const relative = path.relative(cwd, output);

  if (!relative || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))) {
    throw new Error("The guidance output must stay outside the repository checkout.");
  }

  const delivery = await exportGuidance({ paths: projectPaths, cwd, skills });

  await writeDeliveryFiles({ files: delivery.files, destination: output });
  console.log(JSON.stringify({ output, skills: delivery.skills, files: delivery.files.length, fingerprint: delivery.fingerprint }, null, 2));
}

export async function botCommand(arguments_: readonly string[]): Promise<void> {
  const [operation, ...rest] = arguments_;

  if (operation === "setup") {
    await setup(rest);
    return;
  }

  if (operation === "status") {
    await status(rest);
    return;
  }

  if (operation === "export") {
    await exportSkills(rest);
    return;
  }

  console.log(setupSyntax);
  console.log("shadowclone bot export --skill shadowclone-work [--skill name] --output folder");
  console.log("shadowclone bot status [--repo owner/repository]");
}
