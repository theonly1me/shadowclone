import { renderOpencodePlugin } from "./opencodePlugin";
import { renderPiExtension } from "./piExtension";
import type { Integration } from "./types";

export function renderIntegrationExtension(integration: Integration): string {
  switch (integration.agent) {
    case "pi":
      return renderPiExtension(integration);
    case "opencode":
      return renderOpencodePlugin(integration);
    case "claude-code":
    case "codex":
    case "cursor":
    case "antigravity":
      throw new Error(`${integration.agent} has no shadowclone extension`);
  }
}
