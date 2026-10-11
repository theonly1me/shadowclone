loadState();
renderNotes();
connectFileViews();
updateNavigation();
document.getElementById("compare-proposals").textContent = !report.proposals.length
  ? "No agent proposals"
  : state.showProposals
    ? "Hide agent proposals"
    : "Compare agent proposals";
document.querySelectorAll("[data-progress]").forEach((input) => {
  input.checked = state.progress[input.dataset.progress] === true;
});
document.getElementById("export-notes").addEventListener("click", exportNotes);
document.getElementById("save-notes").addEventListener("click", () => {
  saveConnectedNotes().catch((error) => setStatus(error.message));
});
document
  .getElementById("import-notes")
  .addEventListener("click", () => document.getElementById("notes-file").click());
document.getElementById("notes-file").addEventListener("change", (event) => {
  importNotes(event.target.files[0]).catch((error) => setStatus(error.message));
});
document.getElementById("review-notes").addEventListener("click", openNotesPanel);
document
  .getElementById("back-to-guide")
  .addEventListener("click", () => showGroup({ id: activeGroup }));
document.getElementById("compare-proposals").addEventListener("click", revealProposals);
document.getElementById("stage-review").addEventListener("click", () => {
  stageReview().catch((error) => setStatus(error.message));
});
document.getElementById("draft-pr").addEventListener("change", updateDraftButton);
document
  .getElementById("guide-search")
  .addEventListener("input", (event) => searchGuide(event.target.value));
document.getElementById("note-form").addEventListener("submit", saveNote);
document
  .getElementById("close-evidence")
  .addEventListener("click", () => document.getElementById("evidence-reader").close());
document
  .getElementById("cancel-note")
  .addEventListener("click", () => document.getElementById("note-editor").close());
document.getElementById("toggle-theme").addEventListener("click", () => {
  document.documentElement.dataset.theme =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
});
document.addEventListener("click", (event) => {
  const element = event.target.closest("button,a");
  if (!element) return;
  if (element.dataset.guideStep) {
    event.preventDefault();
    showGroup({ id: element.dataset.guideStep });
  }
  if (element.classList.contains("open-notes")) openNotesPanel();
  if (element.dataset.prTab) showPr(element.dataset.prTab);
  if (element.classList.contains("add-note") || element.classList.contains("line-note"))
    openNote(element);
  if (element.dataset.fileView)
    loadFile({ element: element.closest(".file-card"), view: element.dataset.fileView });
  if (element.dataset.stepMove) navigateStep(element);
  if (element.classList.contains("evidence-link")) {
    event.preventDefault();
    showEvidence(element);
  }
  if (element.classList.contains("dismiss-note")) {
    const note = state.notes.find(
      (item) => item.id === element.closest("[data-note-id]").dataset.noteId,
    );
    note.dismissed = !note.dismissed;
    note.selected = false;
    saveState();
    renderNotes();
  }
});
document.addEventListener("change", (event) => {
  const element = event.target;
  if (element.dataset.progress) {
    state.progress[element.dataset.progress] = element.checked;
    saveState();
    updateNavigation();
  }
  if (element.classList.contains("select-note")) {
    const note = state.notes.find(
      (item) => item.id === element.closest("[data-note-id]").dataset.noteId,
    );
    note.selected = element.checked;
    saveState();
    renderNotes();
  }
});
document.addEventListener("input", (event) => {
  const element = event.target;
  if (element.tagName !== "TEXTAREA" || !element.closest("[data-note-id]")) return;
  const note = state.notes.find(
    (item) => item.id === element.closest("[data-note-id]").dataset.noteId,
  );
  note.body = element.value;
  saveState();
});
await connectShadowclone();
