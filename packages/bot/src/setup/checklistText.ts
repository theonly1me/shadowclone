import type { ChecklistItem } from "./checklist";
import type { CloneCheck } from "./check";

export function checklistText(items: readonly ChecklistItem[]): string {
  return items
    .map((item) => {
      const links = item.links.map((link) => `\n     ${link.label}: ${link.url}`).join("");

      return item.done ? `[x] ${item.title}` : `[ ] ${item.title}\n     ${item.action}${links}`;
    })
    .join("\n");
}

export function remainingSteps(items: readonly ChecklistItem[]): readonly ChecklistItem[] {
  return items.filter((item) => !item.done);
}

export function nextStepsText(options: {
  readonly repository: string;
  readonly environmentUrl: string;
  readonly pullUrl: string | null;
  readonly checklist: readonly ChecklistItem[];
}): string {
  const secrets = options.checklist.filter((item) =>
    !item.done && (item.key === "bot-token" || item.key === "provider-key"));
  const sources = secrets.flatMap((item) => item.links.filter((link) => link.url !== options.environmentUrl)
    .map((link) => `   ${item.title}: ${link.label}: ${link.url}`));
  const steps = [
    ...(secrets.length === 0 ? [] : [
      `Add ${secrets.map((item) => item.title).join(" and ")} on the shadowclone environment page:\n   ${options.environmentUrl}${sources.length === 0 ? "" : `\n${sources.join("\n")}`}`,
    ]),
    ...(options.pullUrl === null ? [] : [`Merge the setup pull request:\n   ${options.pullUrl}`]),
    `Then run: shadowclone bot status --repo ${options.repository}`,
  ];

  return steps.map((step, index) => `${index + 1}. ${step}`).join("\n");
}

export function checkText(check: CloneCheck): string {
  if (check.kind === "not-ready") {
    return `The bot is not ready yet:\n${checklistText(remainingSteps(check.checklist))}`;
  }

  if (check.kind === "passed") {
    return `The bot is ready. The check run accepted the invitation and used the API key: ${check.url}`;
  }

  if (check.kind === "failed") {
    return `The check run failed at "${check.step}": ${check.url}`;
  }

  return `The check run is still running${check.url === null ? "" : `: ${check.url}`}. Check the status again to wait for it.`;
}
