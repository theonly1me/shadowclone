import { readEffectiveConfig } from "@shadowclone/core";
import { livePaths } from "@shadowclone/live";
import { fastTierModel } from "./model";
import { writeBrief, type BriefOutcome } from "./writer";

export type MachineBriefOutcome = BriefOutcome | { readonly kind: "off" };

export async function writeMachineBrief(id: string): Promise<MachineBriefOutcome> {
  const { config, policy } = await readEffectiveConfig();

  if (config.remote?.taskBriefs !== true) {
    return { kind: "off" };
  }

  return writeBrief({ paths: livePaths(), id, model: fastTierModel, allowedEngines: policy.allowedEngines });
}
