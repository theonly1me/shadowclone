import { listRevisions, showRevision, undoRevision } from "../changes";
import { readConfig, readEffectiveConfig, writeConfig } from "../config";
import { refreshIntegrations } from "../integrations";
import {
  claimLearningRequests,
  markLearningRequest,
  readLearningState,
  runAutomaticLearning,
  scheduleLearning,
} from "../learning";
import { projectPaths } from "../paths";
import { rememberPreference } from "../preferences";
import { skillRevisionRoots } from "../skillMaintenance";

export async function handlePreferenceCommand(options: {
  readonly command: string | undefined;
  readonly arguments: readonly string[];
}): Promise<boolean> {
  const [action, ...rest] = options.arguments;
  if (options.command === "learn" && action === "--session") {
    const [token] = rest;
    if (!token || rest.length !== 1) {
      throw new Error("Use learn --session <session-token>");
    }
    const { config, policy } = await readEffectiveConfig();
    if (
      !config.distillation.deep ||
      !config.distillation.automatic ||
      policy.distillation !== "allowed"
    ) {
      throw new Error(
        "Session learning requires deep and automatic learning consent",
      );
    }
    const ended = await markLearningRequest({
      paths: projectPaths,
      token,
    });
    if (ended) {
      const sessionKeys = await claimLearningRequests({ paths: projectPaths });
      await scheduleLearning({ sessionKeys });
    }
    console.log("Session queued for private learning after it ends.");
    return true;
  }
  if (options.command === "remember") {
    const scope = action === "--global" ? "global" : "repository";
    const words = action === "--global" || action === "--repo" ? rest : options.arguments;
    if (words.length === 0 || words.some((word) => word.startsWith("--"))) throw new Error("Use remember [--global|--repo] <explicit preference>");
    const key = await rememberPreference({ scope, text: words.join(" ") });
    console.log(`Recorded ${scope} preference ${key}.`);
    return true;
  }
  if (options.command === "history") {
    if (!action) console.log(JSON.stringify(await listRevisions(projectPaths), null, 2));
    else if (rest.length === 0) console.log(await showRevision({ paths: projectPaths, id: action }));
    else throw new Error("Use history [revision-id]");
    return true;
  }
  if (options.command === "undo" && action && rest.length === 0) {
    const revision = await undoRevision({ paths: projectPaths, id: action, skillRoots: await skillRevisionRoots(projectPaths) });
    await refreshIntegrations();
    console.log(revision ? `Restored files in revision ${revision}.` : "Files already match the prior revision.");
    return true;
  }
  if (options.command === "learn" && action === "--automatic") {
    const sessionKeys: string[] = [];
    for (let index = 0; index < rest.length; index += 2) {
      if (rest[index] !== "--session-key" || !rest[index + 1]) {
        throw new Error("Invalid internal learning request");
      }
      sessionKeys.push(rest[index + 1] ?? "");
    }
    await runAutomaticLearning({ sessionKeys });
    return true;
  }
  if (options.command !== "learning") return false;
  if (rest.length !== 0 || !["enable", "disable", "status"].includes(action ?? "status")) throw new Error("Use learning enable|disable|status");
  const { config: effective, policy } = await readEffectiveConfig();
  if (action === "enable" || action === "disable") {
    if (action === "enable" && (!effective.distillation.deep || policy.distillation !== "allowed")) throw new Error("Enable deep learning consent in shadowclone init before automatic learning");
    const config = await readConfig();
    await writeConfig({ config: { ...config, distillation: { ...config.distillation, automatic: action === "enable" } } });
    console.log(`Automatic learning ${action === "enable" ? "enabled" : "disabled"}.`);
  } else {
    const state = await readLearningState(projectPaths);
    console.log(JSON.stringify({ enabled: effective.distillation.automatic === true, status: state.status, lastAttemptAt: state.lastAttemptAt, lastCompletedAt: state.lastCompletedAt }, null, 2));
  }
  return true;
}
