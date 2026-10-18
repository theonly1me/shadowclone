import type { LocalSetupOutcome } from ".";
import { tokenPageUrl } from "./secrets";

function serviceLine(outcome: LocalSetupOutcome): string {
  const { service } = outcome;

  return service.kind === "installed"
    ? `shadowclone serve runs as a service: ${service.file}`
    : service.kind === "failed"
      ? `The service did not start (${service.detail}). Run shadowclone serve in a terminal that stays open.`
      : `This platform (${service.platform}) has no service support. Run shadowclone serve in a terminal that stays open.`;
}

export function setupSummary(outcome: LocalSetupOutcome): readonly string[] {
  const repository = outcome.config.repository;
  const secrets = outcome.secrets.map(
    (line) => `   ${line.name}: ${line.description}${line.required ? "" : " (optional)"}`,
  );
  const claude = outcome.secrets.some((line) => line.name === "CLAUDE_CODE_OAUTH_TOKEN")
    ? ["   Run claude setup-token in a terminal to get the Claude token."]
    : [];
  const steps = [
    `1. Paste these values into ${outcome.secretsFile} in an editor:`,
    ...secrets,
    `   Make GH_TOKEN here: ${tokenPageUrl(outcome.config)}`,
    ...claude,
    ...(outcome.config.provider === "chatgpt-subscription"
      ? [`2. Run shadowclone clone login --repo ${repository}, and enter the code on chatgpt.com.`]
      : []),
  ];
  const numbered = steps.filter((line) => /^\d\./.test(line)).length;

  return [
    `Clones for ${repository} run on this machine, with ${outcome.config.provider}.`,
    "",
    ...steps,
    `${numbered + 1}. Run shadowclone clone status --repo ${repository}.`,
    "",
    `Then start a clone: shadowclone clone start --repo ${repository} "<task>", or ask your agent.`,
    serviceLine(outcome),
    ...outcome.warnings.map((warning) => `Note: ${warning}`),
  ];
}
