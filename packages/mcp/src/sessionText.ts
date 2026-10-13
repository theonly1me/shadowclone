import type { SessionSetupOutcome } from "@shadowclone/clones";

export function setupText(outcome: SessionSetupOutcome): string {
  if (outcome.kind === "needs-docker") {
    return `Docker does not run on this machine (${outcome.detail}). Ask the owner to install and start Docker Desktop, OrbStack, or Docker Engine, then call setup again.`;
  }

  if (outcome.kind === "needs-skills") {
    return `${outcome.skillsRepository} does not exist. Ask the owner to run the skills operation on the main machine, in the repository checkout. Then call setup again.`;
  }

  if (outcome.kind === "needs-ruleset-approval") {
    return `${outcome.summary}\nShow this to the owner. Call setup again with approve true only after the owner agrees.`;
  }

  return [
    `Cloud sessions are set up for ${outcome.config.repository} with ${outcome.config.provider}.`,
    `Ask the owner to paste these values into ${outcome.secretsFile} in an editor. Never ask for the values in chat:`,
    ...outcome.secrets.map(
      (line) => `- ${line.name}: ${line.description}${line.required ? "" : " (optional)"}`,
    ),
    ...(outcome.config.provider === "chatgpt-subscription"
      ? [
          `Then ask the owner to run shadowclone session login --repo ${outcome.config.repository} in a terminal.`,
        ]
      : []),
    "When the owner says done, call status.",
    `Service: ${outcome.service.kind === "failed" ? `failed (${outcome.service.detail})` : outcome.service.kind}.`,
    ...outcome.warnings,
  ].join("\n");
}
