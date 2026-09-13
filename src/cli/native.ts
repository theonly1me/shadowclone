import {
  compileContext, installIntegration, integrationAgentSchema, nativeSessionEnd,
  nativeSessionStart,
  readIntegrations, refreshIntegrations, uninstallIntegration,
  type IntegrationAgent, type IntegrationScope,
} from "../integrations";
import { canonicalPath, projectPaths } from "../paths";
import { installLiveClone } from "./install";
import { uninstallLiveClone } from "./uninstall";
import { removeUneditedLegacySubagent } from "./legacyUpgrade";
import { claimLearningRequests, scheduleLearning } from "../learning";

export type NativeInstallOptions = {
  readonly agents: readonly IntegrationAgent[];
  readonly scope: IntegrationScope;
  readonly subagent: boolean;
  readonly autoDelegate: boolean;
};

export function parseNativeOptions(arguments_: readonly string[]): NativeInstallOptions | null {
  let agents: readonly IntegrationAgent[] = ["claude-code"];
  let scope: IntegrationScope = "global";
  let subagent = false;
  let autoDelegate = false;
  const seen = new Set<string>();
  for (let position = 0; position < arguments_.length; position += 1) {
    const argument = arguments_[position];
    if (!argument || seen.has(argument)) return null;
    seen.add(argument);
    if (argument === "--global") scope = "global";
    else if (argument === "--repo") scope = "repository";
    else if (argument === "--subagent") subagent = true;
    else if (argument === "--auto-delegate") { subagent = true; autoDelegate = true; }
    else if (argument === "--agent") {
      const value = arguments_[++position];
      if (value === "all") agents = integrationAgentSchema.options;
      else {
        const parsed = integrationAgentSchema.safeParse(value);
        if (!parsed.success) return null;
        agents = [parsed.data];
      }
    } else return null;
  }
  if (seen.has("--global") && seen.has("--repo")) return null;
  if (subagent && (scope === "global" || !agents.includes("claude-code"))) return null;
  return { agents, scope, subagent, autoDelegate };
}

export async function installNativeCommand(options: NativeInstallOptions): Promise<void> {
  for (const agent of options.agents) {
    await installIntegration({ agent, scope: options.scope });
    console.log(`Installed ${agent} main-agent guidance (${options.scope}).`);
  }
  if (!options.subagent && await removeUneditedLegacySubagent()) {
    console.log("Removed the unchanged legacy Shadowclone subagent; edited copies are preserved.");
  }
  if (options.subagent) await installLiveClone({ autoDelegate: options.autoDelegate });
}

export async function uninstallNativeCommand(options: NativeInstallOptions & { readonly allAgents?: boolean }): Promise<void> {
  const integrations = await readIntegrations(projectPaths);
  for (const integration of integrations) {
    if (integration.scope !== options.scope || (!options.allAgents && !options.agents.includes(integration.agent))) continue;
    if (integration.scope === "repository" && integration.directory !== canonicalPath(process.cwd())) continue;
    await uninstallIntegration({ integration });
    console.log(`Removed ${integration.agent} managed guidance (${integration.scope}); surrounding content preserved.`);
  }
  if (options.scope === "repository") await uninstallLiveClone();
}

export async function handleNativeCommand(options: {
  readonly command: string | undefined;
  readonly arguments: readonly string[];
}): Promise<boolean> {
  if (options.command === "install" || options.command === "uninstall") {
    const parsed = parseNativeOptions(options.arguments);
    if (!parsed) throw new Error("Use --agent claude-code|codex|cursor|antigravity|all and --global or --repo; subagents require repository Claude installation");
    if (options.command === "install") await installNativeCommand(parsed);
    else await uninstallNativeCommand({ ...parsed, allAgents: !options.arguments.includes("--agent") });
    return true;
  }
  if (options.command === "context" && options.arguments.length === 0) {
    console.log(await compileContext({ cwd: process.cwd() }) ?? "Shadowclone guidance is disabled by policy.");
    return true;
  }
  if (options.command === "sync" && options.arguments.length === 0) {
    const result = await refreshIntegrations();
    console.log(`Refreshed ${result.refreshed} integration(s); preserved ${result.preserved} edited or unavailable integration(s).`);
    return true;
  }
  if (options.command === "hook" && options.arguments.length === 2) {
    const [event, id] = options.arguments;
    if (!id) return false;
    if (event === "native-start") {
      const sessionKeys = await claimLearningRequests({
        paths: projectPaths,
        includeUnended: true,
      });
      if (sessionKeys.length > 0) {
        await scheduleLearning({ sessionKeys });
      }
      const result = await nativeSessionStart({ id, input: await Bun.stdin.text() });
      await Bun.stdout.write(`${JSON.stringify(result)}\n`);
      return true;
    }
    if (event === "native-end") {
      const sessionKey = await nativeSessionEnd({
        id,
        input: await Bun.stdin.text(),
      });
      if (sessionKey) {
        const sessionKeys = await claimLearningRequests({
          paths: projectPaths,
          integrationId: id,
          sessionKey,
        });
        if (sessionKeys.length > 0) {
          await scheduleLearning({ sessionKeys });
        }
      }
      return true;
    }
  }
  return false;
}
