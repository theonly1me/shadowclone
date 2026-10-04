import { syncLearningEnvironment } from "../environment/sync";
import { renderBuildSkillSync } from "../builds/sync";
import { updateBundledSkills } from "../builds/bundledUpdate";
import { parseNativeOptions, type NativeInstallOptions } from "./nativeOptions";

export { parseNativeOptions, type NativeInstallOptions } from "./nativeOptions";
import { explainLearningEnvironment } from "../environment/diagnostics";
import { UnsafeDestinationError } from "../localFiles";
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
import { scheduleLearning, runAutomaticLearning } from "../learning";
import { explainContext, renderContextExplanation } from "./contextExplain";
import { harnessSyncCommand } from "./harnessSync";
import { nativeModelSchema } from "./automaticLearning";

export type SkippedAgent = {
  readonly agent: NativeInstallOptions["agents"][number];
  readonly path: string;
  readonly target: string | null;
};

export function describeSkippedAgent(skipped: SkippedAgent): string {
  const reason =
    skipped.target === null
      ? `${skipped.path} is not a regular file`
      : `${skipped.path} is a symbolic link to ${skipped.target}`;

  return `Not installed for ${skipped.agent}: ${reason}. Shadowclone does not write through links, so ${skipped.agent} gets no Shadowclone guidance. Replace the link with a regular file, then run shadowclone install --agent ${skipped.agent}.`;
}

export async function installNativeCommand(
  options: NativeInstallOptions & {
    readonly skipUnsafeDestinations?: boolean;
    readonly install?: (options: {
      readonly agent: NativeInstallOptions["agents"][number];
      readonly scope: NativeInstallOptions["scope"];
    }) => Promise<unknown>;
  },
): Promise<{ readonly skipped: readonly SkippedAgent[] }> {
  const skipped: SkippedAgent[] = [];

  for (const agent of options.agents) {
    try {
      await (options.install ?? installIntegration)({ agent, scope: options.scope });
      console.log(`Installed ${agent} main-agent guidance (${options.scope}).`);
    } catch (error) {
      if (!options.skipUnsafeDestinations || !(error instanceof UnsafeDestinationError)) {
        throw error;
      }

      skipped.push({ agent, path: error.path, target: error.target });
    }
  }

  if (!options.subagent && (await removeUneditedLegacySubagent())) {
    console.log(
      "Removed the unchanged legacy Shadowclone subagent; edited copies are preserved.",
    );
  }

  if (options.subagent) {
    await installLiveClone({ autoDelegate: options.autoDelegate });
  }

  return { skipped };
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
        "Use --agent claude-code|codex|cursor|antigravity|pi|all and --global or --local; subagents require local Claude installation",
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
    const bundled = await updateBundledSkills(projectPaths);

    for (const line of bundled ? renderBuildSkillSync(bundled) : []) {
      console.log(line);
    }

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
      const input = await Bun.stdin.text();
      const sessionKey = await nativeSessionEnd({
        id,
        input,
      });

      if (sessionKey) {
        const selection = nativeModelSchema.parse(JSON.parse(input || "{}"));
        if (selection.engine === "pi" && process.env.SHADOWCLONE_PI_SOCKET) {
          await runAutomaticLearning({ sessionKeys: [sessionKey], ...selection });
        } else {
          await scheduleLearning({ sessionKeys: [sessionKey], ...selection });
        }
      }

      return true;
    }
  }

  return false;
}
