function noteCard(note) {
  const pull = report.pulls.find((item) => item.id === note.pr);
  const label = note.author === "agent" ? "Agent proposal" : "Your note";
  const source = note.source
    ? note.source.path +
      ":" +
      note.source.start +
      (note.source.end > note.source.start ? " to " + note.source.end : "")
    : "Document passage";
  const explanation =
    note.author === "agent"
      ? "<details><summary>Inspect the reasoning</summary><p><b>Why:</b> " +
        escapeHtml(note.reason) +
        "</p><p><b>Proof:</b> " +
        escapeHtml(note.verification) +
        "</p><p><b>Counterevidence:</b> " +
        escapeHtml(note.counterevidence) +
        "</p></details>"
      : "";
  return (
    '<article class="note-card ' +
    note.author +
    (note.dismissed ? " dismissed" : "") +
    '" data-note-id="' +
    escapeHtml(note.id) +
    '"><div class="note-meta"><b>' +
    label +
    '</b><span class="badge">' +
    "PR #" +
    pull.number +
    "</span><span>" +
    escapeHtml(source) +
    "</span></div><blockquote>" +
    escapeHtml(note.quote) +
    '</blockquote><textarea aria-label="Edit comment">' +
    escapeHtml(note.body) +
    "</textarea>" +
    explanation +
    "<details><summary>Original wording</summary><p>" +
    escapeHtml(note.originalBody) +
    '</p></details><div class="note-footer"><label><input type="checkbox" class="select-note"' +
    (note.selected ? " checked" : "") +
    (note.dismissed ? " disabled" : "") +
    '> Include in draft</label><button class="quiet dismiss-note" type="button">' +
    (note.dismissed ? "Restore" : "Dismiss") +
    "</button></div>" +
    (note.draftUrl
      ? '<a href="' +
        escapeHtml(safeUrl(note.draftUrl) ?? "#") +
        '" target="_blank" rel="noreferrer">Open pending review</a>'
      : "") +
    "</article>"
  );
}

function renderNotes() {
  document.querySelectorAll(".note-list").forEach((element) => {
    element.innerHTML = state.notes
      .filter(
        (note) =>
          (note.author === "human" || state.showProposals) &&
          note.anchor === element.dataset.notesFor,
      )
      .map(noteCard)
      .join("");
  });
  document.querySelectorAll(".agent-proposals").forEach((element) => {
    const notes = state.notes.filter((note) => {
      const proposal = report.proposals.find((item) => "proposal-" + item.id === note.id);
      if (note.author !== "agent" || proposal?.group !== element.dataset.proposalsFor) return false;
      const inline = [...element.closest(".group-section").querySelectorAll(".note-list")].find(
        (item) => item.dataset.notesFor === note.anchor,
      );
      return !inline || inline.closest(".file-card")?.open !== true;
    });
    element.hidden = !state.showProposals || !notes.length;
    element.innerHTML = "<h3>Agent proposals to discuss</h3>" + notes.map(noteCard).join("");
  });
  const anchorIds = new Set(
    [...document.querySelectorAll("[data-anchor]")].map((element) => element.dataset.anchor),
  );
  const remaining = state.notes.filter(
    (note) => note.author === "human" && !anchorIds.has(note.anchor),
  );
  document.getElementById("additional-notes").innerHTML = remaining.length
    ? "<h3>Notes on code and other passages</h3>" + remaining.map(noteCard).join("")
    : "";
  const compare = document.getElementById("compare-proposals");
  compare.disabled = report.proposals.length === 0;
  if (compare.disabled) compare.textContent = "No agent proposals";
  const visibleNotes = state.notes.filter((note) => note.author === "human" || state.showProposals);
  document.getElementById("all-notes").innerHTML = visibleNotes.length
    ? visibleNotes.map(noteCard).join("")
    : '<p class="empty-notes">Add a note beside an explanation or a code line. Your notes will appear here.</p>';
  document.getElementById("notes-count").textContent = String(
    visibleNotes.filter((note) => !note.dismissed).length,
  );
  updateDraftButton();
}

function openNote(element) {
  const selection = window.getSelection();
  const selectedText = selection?.toString().trim() ?? "";
  const annotation = element.closest("[data-anchor]");
  if (!annotation) return;
  const evidence = report.evidence.find((item) => item.id === annotation.dataset.evidence);
  const prIds = annotation.dataset.pr
    ? [annotation.dataset.pr]
    : (annotation.dataset.prs ?? "").split(",").filter(Boolean);
  let source = evidence
    ? { path: evidence.path, side: evidence.side, start: evidence.start, end: evidence.end }
    : null;
  if (annotation.dataset.line) {
    const startNode = selection?.anchorNode?.parentElement?.closest("[data-line]");
    const endNode = selection?.focusNode?.parentElement?.closest("[data-line]");
    const sameRange =
      startNode &&
      endNode &&
      startNode.dataset.path === annotation.dataset.path &&
      endNode.dataset.path === annotation.dataset.path &&
      startNode.dataset.side === annotation.dataset.side &&
      endNode.dataset.side === annotation.dataset.side &&
      startNode.dataset.pr === annotation.dataset.pr &&
      endNode.dataset.pr === annotation.dataset.pr;
    const line = Number(annotation.dataset.line);
    source = {
      path: annotation.dataset.path,
      side: annotation.dataset.side,
      start: sameRange
        ? Math.min(Number(startNode.dataset.line), Number(endNode.dataset.line))
        : line,
      end: sameRange
        ? Math.max(Number(startNode.dataset.line), Number(endNode.dataset.line))
        : line,
    };
  }
  editingContext = {
    anchor: annotation.dataset.anchor,
    quote:
      selectedText ||
      evidence?.text ||
      annotation.querySelector("code")?.textContent ||
      annotation.closest(".group-section")?.querySelector("h2")?.textContent ||
      "",
    source,
    evidence: evidence ? [evidence.id] : [],
  };
  const options = prIds.map((id) => report.pulls.find((pull) => pull.id === id)).filter(Boolean);
  document.getElementById("note-pr").innerHTML =
    (options.length > 1 ? '<option value="">Choose the PR for this note</option>' : "") +
    options
      .map(
        (pull) =>
          '<option value="' +
          pull.id +
          '">' +
          escapeHtml(pull.id + " · " + pull.title) +
          "</option>",
      )
      .join("");
  document.getElementById("note-quote").textContent = editingContext.quote;
  document.getElementById("note-body").value = "";
  document.getElementById("note-editor").showModal();
  document.getElementById("note-body").focus();
}

function saveNote(event) {
  event.preventDefault();
  if (!editingContext) return;
  const body = document.getElementById("note-body").value.trim();
  const pr = document.getElementById("note-pr").value;
  if (!body || !pr) return;
  const originalEvidence = editingContext.evidence.map((id) =>
    report.evidence.find((item) => item.id === id),
  );
  const source = originalEvidence.some((item) => item.pr !== pr) ? null : editingContext.source;
  state.notes.push({
    id: crypto.randomUUID(),
    author: "human",
    pr,
    ...editingContext,
    source,
    body,
    originalBody: body,
    selected: false,
    dismissed: false,
  });
  saveState();
  renderNotes();
  document.getElementById("note-editor").close();
  editingContext = null;
  setStatus("Note added. Select Include in draft when you want to stage it.");
}
