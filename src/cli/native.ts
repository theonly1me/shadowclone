import { syncLearningEnvironment } from "../environment/sync";
import { parseNativeOptions, type NativeInstallOptions } from "./nativeOptions";

export { parseNativeOptions, type NativeInstallOptions } from "./nativeOptions";
import { explainLearningEnvironment } from "../environment/diagnostics";
import {
  compileContext,
  compileContextDetails,
  installIntegration,
  nativeSessionEnd,
  nativeSessionStart,
  readIntegrations,
  refreshIntegrations,
  sessionStartProjection,
  uninstallIntegration,
} from "../integrations";
import { canonicalPath, projectPaths } from "../paths";
import { installLiveClone } from "./install";
import { uninstallLiveClone } from "./uninstall";
import { removeUneditedLegacySubagent } from "./legacyUpgrade";
import { scheduleLearning } from "../learning";
import { explainContext, renderContextExplanation } from "./contextExplain";
import { harnessSyncCommand } from "./harnessSync";

export async function installNativeCommand(
  options: NativeInstallOptions,
): Promise<void> {
  for (const agent of options.agents) {
    await installIntegration({ agent, scope: options.scope });
    console.log(`Installed ${agent} main-agent guidance (${options.scope}).`);
  }

  if (!options.subagent && (await removeUneditedLegacySubagent())) {
    console.log(
      "Removed the unchanged legacy Shadowclone subagent; edited copies are preserved.",
    );
  }

  if (options.subagent) {
    await installLiveClone({ autoDelegate: options.autoDelegate });
  }
}

export async function uninstallNativeCommand(
  options: NativeInstallOptions & { readonly allAgents?: boolean },
): Promise<void> {
  const integrations = await readIntegrations(projectPaths);

  for (const integration of integrations) {
    if (
      integration.scope !== options.scope ||
      (!options.allAgents && !options.agents.includes(integration.agent))
    ) {
      continue;
    }

    if (
      integration.scope === "repository" &&
      integration.directory !== canonicalPath(process.cwd())
    ) {
      continue;
    }

    await uninstallIntegration({ integration });
    console.log(
      `Removed ${integration.agent} managed guidance (${integration.scope}); surrounding content preserved.`,
    );
  }

  if (options.scope === "repository") {
    await uninstallLiveClone();
  }
}

export async function handleNativeCommand(options: {
  readonly command: string | undefined;
  readonly arguments: readonly string[];
}): Promise<boolean> {
  if (options.command === "install" || options.command === "uninstall") {
    const parsed = parseNativeOptions(options.arguments);

    if (!parsed) {
      throw new Error(
        "Use --agent claude-code|codex|cursor|antigravity|all and --global or --local; subagents require local Claude installation",
      );
    }

    if (options.command === "install") {
      await installNativeCommand(parsed);
    } else {
      await uninstallNativeCommand({
        ...parsed,
        allAgents: !options.arguments.includes("--agent"),
      });
    }

    return true;
  }

  if (options.command === "context" && options.arguments.length === 0) {
    console.log(
      (await compileContext({ cwd: process.cwd() })) ??
        "Shadowclone guidance is disabled by policy.",
    );

    return true;
  }

  if (
    options.command === "context" &&
    (options.arguments.length === 1 || options.arguments.length === 2) &&
    options.arguments[0] === "--explain" &&
    (options.arguments.length === 1 || options.arguments[1] === "--json")
  ) {
    const environment = await explainLearningEnvironment({
      paths: projectPaths,
      cwd: process.cwd(),
    });

    if (environment !== null) {
      await Bun.stdout.write(`${environment}\n`);

      return true;
    }

    const details = await compileContextDetails({
      cwd: process.cwd(),
      ...sessionStartProjection,
    });

    if (details === null) {
      await Bun.stdout.write("Shadowclone guidance is disabled by policy.\n");

      return true;
    }

    const explanation = explainContext(details);

    await Bun.stdout.write(
      options.arguments[1] === "--json"
        ? `${JSON.stringify(explanation, null, 2)}\n`
        : renderContextExplanation(explanation),
    );

    return true;
  }

  if (options.command === "sync" && options.arguments.length === 0) {
    if (await syncLearningEnvironment(projectPaths)) {
      console.log("Synchronized learned skills and native routing.");

      return true;
    }

    const result = await refreshIntegrations();

    console.log(
      `Refreshed ${result.refreshed} integration(s); preserved ${result.preserved} edited or unavailable integration(s).`,
    );
    await harnessSyncCommand({ apply: "confirm" });

    return true;
  }

  if (options.command === "hook" && options.arguments.length === 2) {
    const [event, id] = options.arguments;

    if (!id) {
      return false;
    }

    if (event === "native-start") {
      const result = await nativeSessionStart({
        id,
        input: await Bun.stdin.text(),
      });

      await Bun.stdout.write(`${JSON.stringify(result)}\n`);

      return true;
    }

    if (event === "native-end") {
      const sessionKey = await nativeSessionEnd({
        id,
        input: await Bun.stdin.text(),
      });

      if (sessionKey) {
        await scheduleLearning({ sessionKeys: [sessionKey] });
      }

      return true;
    }
  }

  return false;
}
