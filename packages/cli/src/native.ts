import {
  compileContext,
  explainLearningEnvironment,
  missingEnvironmentMessage,
  installIntegration,
  nativeSessionEnd,
  nativeSessionStart,
  readIntegrations,
  refreshIntegrations,
  type ReplacedRouting,
  type SkippedRouting,
  syncLearningEnvironment,
  uninstallIntegration,
} from "@shadowclone/environment";
import { renderBundledSkillReport, updateBundledSkills } from "@shadowclone/builds";
import { parseNativeOptions, type NativeInstallOptions } from "./nativeOptions";

export { parseNativeOptions, type NativeInstallOptions } from "./nativeOptions";
import { describeSkippedAgent, skippedAgentFrom, type SkippedAgent } from "./skippedAgents";
import { canonicalPath, projectPaths } from "@shadowclone/core";
import { installLiveClone } from "./install";
import { uninstallLiveClone } from "./uninstall";
import { scheduleLearning, runAutomaticLearning } from "@shadowclone/learning";
import { harnessSyncCommand } from "./harnessSync";
import { syncReportLines } from "./syncReport";
import { nativeModelSchema } from "./automaticLearning";

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
      const skip = skippedAgentFrom({
        agent,
        error,
        skipUnsafeDestinations: options.skipUnsafeDestinations ?? false,
      });

      if (skip === null) {
        throw error;
      }

      skipped.push(skip);
    }
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
        "Use --agent claude-code|codex|cursor|antigravity|pi|opencode|all and --global or --local; subagents require local Claude installation",
      );
    }

    if (options.command === "install") {
      const { skipped } = await installNativeCommand(parsed);

      for (const entry of skipped) {
        console.log(describeSkippedAgent(entry));
      }

      if (skipped.length > 0) {
        process.exitCode = 1;
      }
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
        "shadowclone guidance is disabled by policy.",
    );

    return true;
  }

  if (
    options.command === "context" &&
    options.arguments.length === 1 &&
    options.arguments[0] === "--explain"
  ) {
    const environment = await explainLearningEnvironment({
      paths: projectPaths,
      cwd: process.cwd(),
    });

    await Bun.stdout.write(`${environment ?? missingEnvironmentMessage}\n`);

    return true;
  }

  if (
    options.command === "sync" &&
    (options.arguments.length === 0 ||
      (options.arguments.length === 1 && options.arguments[0] === "--replace-edited"))
  ) {
    const bundled = await updateBundledSkills(projectPaths);

    for (const line of bundled ? renderBundledSkillReport(bundled) : []) {
      console.log(line);
    }

    if (
      bundled?.retired.some((change) => change.kind === "failed") ||
      bundled?.alwaysOn.some((change) => change.kind === "failed")
    ) {
      process.exitCode = 1;
    }

    const skipped: SkippedRouting[] = [];
    const replaced: ReplacedRouting[] = [];
    const removed: string[] = [];

    if (
      await syncLearningEnvironment(projectPaths, {
        onSkipped: (entries) => skipped.push(...entries),
        onReplaced: (entries) => replaced.push(...entries),
        onRemovedRepositories: (directories) => removed.push(...directories),
        replaceEdited: options.arguments[0] === "--replace-edited",
      })
    ) {
      for (const line of syncReportLines({ removed, replaced, skipped })) {
        console.log(line);
      }

      if (skipped.length > 0) process.exitCode = 1;

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
