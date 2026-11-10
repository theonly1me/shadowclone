import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import { boardActions, readAnswer, showAnswer } from "./actions";
import { renderBoard } from "./render";
import { boardNoticeKey, emptyState } from "./state";

const state = emptyState();
const root = document.getElementById("board") ?? document.body;
const app = new App(
  { name: "shadowclone session board", version: "1.0.0" },
  {},
  { autoResize: true },
);

function render(): void {
  renderBoard({ root, state, actions });
}

const actions = boardActions({ app, state, render });

function useHostContext(context: Partial<McpUiHostContext>): void {
  if (context.theme !== undefined) {
    applyDocumentTheme(context.theme);
  }

  if (context.styles?.variables !== undefined) {
    applyHostStyleVariables(context.styles.variables);
  }

  if (context.styles?.css?.fonts !== undefined) {
    applyHostFonts(context.styles.css.fonts);
  }

  if (context.displayMode !== undefined) {
    state.fullscreen = context.displayMode === "fullscreen";
  }

  if (context.availableDisplayModes !== undefined) {
    state.canFullscreen = context.availableDisplayModes.includes("fullscreen");
  }

  render();
}

app.ontoolresult = (result) => {
  showAnswer({ state, answer: readAnswer(result) });
  render();
};
app.onhostcontextchanged = useHostContext;

render();
app
  .connect()
  .then(() => useHostContext(app.getHostContext() ?? {}))
  .catch(() => {
    state.notices.set(boardNoticeKey, {
      tone: "fault",
      text: "The board could not connect to the host.",
    });
    render();
  });
