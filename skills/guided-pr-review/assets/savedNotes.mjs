let notesFingerprint = null;

async function loadConnectedNotes() {
  const response = await fetch("/api/notes", {
    headers: { "X-Shadowclone-Token": location.hash.slice(1) },
  });
  if (!response.ok)
    throw new Error("Saved notes could not be loaded. Export this copy before changing storage.");
  const saved = await response.json();
  notesFingerprint = saved.fingerprint;
  if (!saved.state) return;
  let conflicts = 0;
  const merged = new Map(state.notes.map((note) => [note.id, note]));
  for (const note of saved.state.notes) {
    const local = merged.get(note.id);
    if (
      !local ||
      (local.author === "agent" &&
        local.body === local.originalBody &&
        !local.selected &&
        !local.dismissed &&
        !local.draftUrl)
    )
      merged.set(note.id, note);
    else if (local.body !== note.body && !merged.has(note.id + "-saved")) {
      merged.set(note.id + "-saved", { ...note, id: note.id + "-saved", selected: false });
      conflicts += 1;
    }
  }
  state.notes = [...merged.values()];
  state.progress = { ...saved.state.progress, ...state.progress };
  state.showProposals = state.showProposals || saved.state.showProposals;
  saveState();
  renderNotes();
  document.getElementById("compare-proposals").textContent = !report.proposals.length
    ? "No agent proposals"
    : state.showProposals
      ? "Hide agent proposals"
      : "Compare agent proposals";
  document.querySelectorAll("[data-progress]").forEach((input) => {
    input.checked = state.progress[input.dataset.progress] === true;
  });
  updateNavigation();
  if (conflicts)
    setStatus(
      conflicts +
        " differing saved notes were preserved as separate copies. Compare them before staging.",
    );
}

async function saveConnectedNotes(options = {}) {
  saveState();
  if (!connection) {
    if (!options.silent)
      setStatus("Notes saved in this browser. Export a copy before moving the document.");
    return;
  }
  const response = await fetch("/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shadowclone-Token": location.hash.slice(1) },
    body: JSON.stringify({
      expectedFingerprint: notesFingerprint,
      state: {
        version: 1,
        reportId: report.reportId,
        notes: state.notes,
        progress: state.progress,
        showProposals: state.showProposals,
      },
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Notes could not be saved.");
  notesFingerprint = result.fingerprint;
  if (!options.silent)
    setStatus("Notes saved in private local storage. Opening another connection can restore them.");
}
