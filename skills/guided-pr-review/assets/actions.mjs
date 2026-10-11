function updateDraftButton() {
  const notes = selectedNotes();
  const button = document.getElementById("stage-review");
  button.disabled = !connection || !connection.engine || staging || notes.length === 0;
  button.textContent = staging ? "Preparing draft…" : "Leave draft review on PR";
  document.getElementById("selected-count").textContent = notes.length + " selected";
}

async function connectShadowclone() {
  if (!/^https?:$/.test(location.protocol)) {
    setStatus(
      "Standalone document. Notes and exports work here. Open through shadowclone review open to enable draft staging.",
    );
    return;
  }
  try {
    const response = await fetch("/api/connection", {
      headers: { "X-Shadowclone-Token": location.hash.slice(1) },
    });
    if (!response.ok) throw new Error("No connection");
    connection = await response.json();
    if (connection.reportId !== report.reportId) throw new Error("Wrong report");
    setStatus(
      connection.engine
        ? "Drafts use " +
            connection.engine +
            " as " +
            connection.login +
            ". Only selected notes become pending comments."
        : "No authenticated Claude Code or Codex engine is available. Notes remain local.",
    );
    await loadConnectedNotes();
    updateDraftButton();
  } catch {
    connection = null;
    setStatus(
      "Standalone document. Notes and exports work here. Use shadowclone review open to connect the draft action.",
    );
  }
}

async function stageReview() {
  const notes = selectedNotes();
  if (!connection || !notes.length || staging) return;
  staging = true;
  updateDraftButton();
  setStatus("Checking your selected notes, current code, and comment anchors.");
  try {
    await saveConnectedNotes({ silent: true });
    const response = await fetch("/api/draft-review", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shadowclone-Token": location.hash.slice(1),
      },
      body: JSON.stringify({
        reportId: report.reportId,
        pr: document.getElementById("draft-pr").value,
        notes,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Draft staging failed.");
    for (const note of state.notes) {
      if (result.stagedIds.includes(note.id)) {
        note.draftUrl = result.url;
        note.selected = false;
      }
    }
    saveState();
    renderNotes();
    setStatus(
      "Staged " +
        result.stagedIds.length +
        " comments. " +
        result.held.length +
        " notes remain local." +
        (result.held.length ? " " + result.held.map((item) => item.reason).join(" ") : ""),
    );
    const link = document.getElementById("draft-link");
    link.hidden = !result.url;
    if (result.url) {
      link.href = result.url;
      link.textContent = "Inspect your pending review";
    }
  } catch (error) {
    setStatus(error.message + " Your notes remain saved. No success is assumed.");
  } finally {
    staging = false;
    updateDraftButton();
  }
}

async function importNotes(file) {
  if (!file) return;
  try {
    const exported = JSON.parse(await file.text());
    if (exported.reportId !== report.reportId || !Array.isArray(exported.notes))
      throw new Error("The notes belong to a different report revision.");
    if (exported.notes.some((note) => !validNote(note)))
      throw new Error("The note export is invalid. Existing notes were preserved.");
    const merged = new Map(state.notes.map((note) => [note.id, note]));
    for (const note of exported.notes) if (!merged.has(note.id)) merged.set(note.id, note);
    state.notes = [...merged.values()];
    saveState();
    renderNotes();
    setStatus("Notes imported. Existing edits were preserved.");
  } catch (error) {
    setStatus(error.message);
  }
}
