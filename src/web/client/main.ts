import { buildScopeSchema, type BuildScope } from "../../builds/types";
import { buildViewSchema } from "../protocol";
import { request } from "./api";
import { openCustomEditor, saveCustomSkill } from "./custom";
import { renderDetail } from "./detail";
import { renderModelDescription, reviewDescription } from "./description";
import { element, input, notice, reportError, select } from "./dom";
import { renderIdentity } from "./identity";
import { applyReviewedBuild, reviewChanges, undoAppliedBuild } from "./review";
import { editor, equipped } from "./state";
import { renderTree } from "./tree";
import { initializeStarfield } from "./starfield";
import { initializeConnections, renderConnections } from "./connections";
import { initializeCustomGeneration, customStatus } from "./customGeneration";
import { perform, actionButton } from "./actions";
import { initializeEditorDialogs } from "./editorDialogs";

initializeEditorDialogs();

function render(): void {
  renderTree({
    inspect: (id) => {
      editor.activeId = id;
      render();
    },
  });
  renderDetail({ rerender: render, companion: openCustomEditor });
  renderIdentity();
  renderModelDescription();
  renderConnections();
  element("undo").hidden = editor.view?.revisionId === null;
}

async function loadBuild(scope: BuildScope): Promise<void> {
  const view = await request({
    path: `/api/build?scope=${scope}`,
    schema: buildViewSchema,
  });

  editor.view = view;
  editor.input = structuredClone(view.input);
  editor.dirty = false;

  if (!view.items.some((item) => item.id === editor.activeId)) {
    editor.activeId = view.items.find(equipped)?.id ?? view.items[0]?.id ?? "";
  }

  select("scope").value = scope;

  const scopeNotes = {
    global: "Your personal build follows you across coding agents.",
    private:
      "Only this repository. Stored privately on your machine; shared requirements stay in force.",
    shared:
      "A portable build for this repository. Review every file before sharing it with your team.",
  };

  element("scope-note").textContent = scopeNotes[scope];
  element("library-note").hidden = view.libraryEnabled;

  if (view.migrationRequired) {
    notice({
      message:
        "Your existing profile needs its reviewed skills migration before this build can be applied. You can explore the editor now.",
    });
  }

  render();
}

actionButton({ id: "review", action: reviewChanges });
actionButton({ id: "describe", action: reviewDescription });

actionButton({
  id: "apply",
  action: async () => {
    await applyReviewedBuild();
    await loadBuild(editor.input.scope);
  },
});

actionButton({
  id: "undo",
  action: async () => {
    await undoAppliedBuild();
    await loadBuild(editor.input.scope);
  },
});

element("new-skill").addEventListener("click", () => openCustomEditor());
element("custom-form").addEventListener("submit", (event) => {
  event.preventDefault();

  try {
    saveCustomSkill();
    render();
  } catch (error) {
    customStatus(
      error instanceof Error ? error.message : "The skill could not be added.",
    );
  }
});

input("search").addEventListener("input", () => {
  editor.search = input("search").value;
  render();
});

select("scope").addEventListener("change", () => {
  if (
    editor.dirty &&
    !window.confirm("Discard the draft and switch build scope?")
  ) {
    select("scope").value = editor.input.scope;

    return;
  }

  const scope = buildScopeSchema.parse(select("scope").value);

  perform(() => loadBuild(scope)).catch(reportError);
});

for (const button of document.querySelectorAll(".close-dialog")) {
  button.addEventListener("click", () => button.closest("dialog")?.close());
}

window.addEventListener("beforeunload", (event) => {
  if (editor.dirty) {
    event.preventDefault();
  }
});

const scope = buildScopeSchema.safeParse(
  new URLSearchParams(location.search).get("scope") ?? "global",
);

initializeStarfield();
initializeConnections();
initializeCustomGeneration();
loadBuild(scope.success ? scope.data : "global").catch(reportError);
