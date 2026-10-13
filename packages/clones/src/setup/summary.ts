import type { SessionSetupOutcome } from ".";
import { tokenPageUrl } from "./secrets";

type Finished = Extract<SessionSetupOutcome, { readonly kind: "configured" | "configured-cloud" }>;

function serviceLine(
  outcome: Extract<SessionSetupOutcome, { readonly kind: "configured" }>,
): string {
  const { service } = outcome;

  return service.kind === "installed"
    ? `shadowclone serve runs as a service: ${service.file}`
    : service.kind === "failed"
      ? `The service did not start (${service.detail}). Run shadowclone serve in a terminal that stays open.`
      : `This platform (${service.platform}) has no service support. Run shadowclone serve in a terminal that stays open.`;
}

function tokenSteps(outcome: Finished): readonly string[] {
  const repository = outcome.config.repository;
  const secrets = outcome.secrets.map(
    (line) => `   ${line.name}: ${line.description}${line.required ? "" : " (optional)"}`,
  );
  const claude = outcome.secrets.some((line) => line.name === "CLAUDE_CODE_OAUTH_TOKEN")
    ? ["   Run claude setup-token in a terminal to get the Claude token."]
    : [];
  const token = [`   Make GH_TOKEN here: ${tokenPageUrl(outcome.config)}`];

  if (outcome.kind === "configured") {
    return [
      `1. Paste these values into ${outcome.secretsFile} in an editor:`,
      ...secrets,
      ...token,
      ...claude,
    ];
  }

  const interactive = ["cloudflare", "vercel"].includes(
    outcome.config.receiver ?? outcome.config.host,
  );

  return [
    interactive
      ? `1. Add these secrets to ${outcome.secretPlace}. shadowclone session secrets --repo ${repository} asks for each one in a terminal:`
      : `1. Add these secrets to ${outcome.secretPlace}:`,
    ...secrets,
    ...token,
    ...claude,
  ];
}

export function setupSummary(outcome: Finished): readonly string[] {
  const repository = outcome.config.repository;
  const where =
    outcome.kind === "configured"
      ? "this machine"
      : `${outcome.config.host}, receiving GitHub events at ${outcome.url}`;
  const steps = [
    ...tokenSteps(outcome),
    ...(outcome.kind === "configured" && outcome.config.provider === "chatgpt-subscription"
      ? [
          `2. Run shadowclone session login --repo ${repository}, and enter the code on chatgpt.com.`,
        ]
      : []),
    ...(outcome.kind === "configured-cloud" && outcome.sandboxStep !== null
      ? [`2. ${outcome.sandboxStep}`]
      : []),
  ];

  return [
    `Cloud sessions for ${repository} run on ${where}, with ${outcome.config.provider}.`,
    "",
    ...steps,
    `${steps.filter((line) => /^\d\./.test(line)).length + 1}. Run shadowclone session status --repo ${repository}.`,
    "",
    `Then comment /shadowclone <task> on an issue or pull request in ${repository}.`,
    ...(outcome.kind === "configured" ? [serviceLine(outcome)] : []),
    ...(outcome.warnings ?? []).map((warning) => `Note: ${warning}`),
  ];
}
