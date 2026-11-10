import { boardHtml } from "./html";

export const boardResourceUri = "ui://shadowclone/board.html";

const boardMimeType = "text/html;profile=mcp-app";

export const boardResources = {
  list: [
    {
      uri: boardResourceUri,
      name: "session_board",
      title: "Session board",
      description: "The live Claude Code and Codex sessions of the owner, with reply and pairing.",
      mimeType: boardMimeType,
    },
  ],
  read: (uri: string) =>
    uri === boardResourceUri ? [{ uri, mimeType: boardMimeType, text: boardHtml }] : null,
};

type BoardViewMeta = { readonly _meta?: { readonly ui: { readonly resourceUri: string } } };

export function withBoardView<Tool extends { readonly name: string }>(
  tools: readonly Tool[],
): readonly (Tool & BoardViewMeta)[] {
  return tools.map((tool) =>
    tool.name === "shadowclone_sessions"
      ? { ...tool, _meta: { ui: { resourceUri: boardResourceUri } } }
      : tool,
  );
}
