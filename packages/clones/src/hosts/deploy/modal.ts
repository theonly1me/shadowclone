import { configVariable, webhookSecretVariable } from "../../receivers/runtime";
import { modalCli, modalDispatch, modalInstall, modalNames, modalUrl } from "../modal";
import {
  failure,
  receiverSecretSteps,
  runIn,
  writeProject,
  type DeployContext,
  type DeployOutcome,
} from "./types";

export async function deployModal(context: DeployContext): Promise<DeployOutcome> {
  const names = modalNames(context.config);

  await writeProject({
    directory: context.directory,
    files: { "dispatch.py": modalDispatch(context.config) },
  });

  const profile = await runIn({ context, command: [...modalCli, "profile", "current"] }).catch(
    () => null,
  );

  if (profile === null) {
    return { kind: "needs-tool", detail: `Install the Modal CLI with ${modalInstall}.` };
  }

  if (profile.exitCode !== 0) {
    return { kind: "needs-login", command: "modal setup" };
  }

  const secret = await runIn({
    context,
    command: [
      ...modalCli,
      "secret",
      "create",
      names.receiverSecret,
      `${webhookSecretVariable}=${context.webhookSecret}`,
      `${configVariable}=${JSON.stringify(context.config)}`,
      "--force",
    ],
  });

  if (secret.exitCode !== 0) {
    throw failure({ step: "modal secret create", result: secret });
  }

  const deployed = await runIn({ context, command: [...modalCli, "deploy", "dispatch.py"] });
  const url = modalUrl(`${deployed.stdout}\n${deployed.stderr}`);

  if (deployed.exitCode !== 0 || url === null) {
    throw failure({ step: "modal deploy", result: deployed });
  }

  return {
    kind: "deployed",
    url,
    directory: context.directory,
    secrets: receiverSecretSteps(context.config),
    secretPlace: `the Modal secret ${names.runSecret}`,
    afterSecrets: [],
  };
}
