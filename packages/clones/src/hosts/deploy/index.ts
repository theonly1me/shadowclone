import { deployCloudflare } from "./cloudflare";
import { deployDeno, deploySupabase } from "./edge";
import { deployModal } from "./modal";
import { prepareSandboxHost, type SandboxPreparation } from "./sandboxes";
import type { DeployContext, DeployOutcome } from "./types";
import { deployVercel } from "./vercel";

export type CloudDeployment = {
  readonly receiver: DeployOutcome;
  readonly sandbox: SandboxPreparation;
};

function receiverOf(context: DeployContext): string {
  return context.config.receiver ?? context.config.host;
}

const deployers: Readonly<Record<string, (context: DeployContext) => Promise<DeployOutcome>>> = {
  cloudflare: deployCloudflare,
  vercel: deployVercel,
  supabase: deploySupabase,
  deno: deployDeno,
  modal: deployModal,
};

export async function deployCloudHost(context: DeployContext): Promise<CloudDeployment> {
  const deploy = deployers[receiverOf(context)];

  if (deploy === undefined) {
    throw new Error(`${receiverOf(context)} is not a cloud receiver.`);
  }

  const sandbox = await prepareSandboxHost(context);

  return { receiver: await deploy(context), sandbox };
}
