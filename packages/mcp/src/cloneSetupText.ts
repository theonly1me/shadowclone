import { setupSummary, type CloneSetupOutcome } from "@shadowclone/clones";

export function setupText(outcome: CloneSetupOutcome): string {
  if (outcome.kind === "needs-docker") {
    return `Docker does not run on this machine (${outcome.detail}). Ask the owner to install and start Docker Desktop, OrbStack, or Docker Engine, then call setup again.`;
  }

  if (outcome.kind === "needs-skills") {
    return `${outcome.skillsRepository} does not exist. Call skills in the repository checkout on the machine that has the owner's skills. Then call setup again.`;
  }

  if (outcome.kind === "needs-ruleset-approval") {
    return `${outcome.summary}\nShow this to the owner. Call setup again with approve true only after the owner agrees.`;
  }

  return [
    ...setupSummary(outcome),
    "",
    "Give the owner these steps. Never ask for a token in chat. When the owner says done, call status.",
  ].join("\n");
}
