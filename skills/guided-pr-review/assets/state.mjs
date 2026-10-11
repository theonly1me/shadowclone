const report = JSON.parse(document.getElementById("guided-review").textContent);
const storageKey = "shadowclone-guided-review:" + report.reportId;
let selectedPr = "stack";
let connection = null;
let editingContext = null;
let staging = false;
const statusElement = document.getElementById("action-status");
const state = { notes: [], progress: {}, showProposals: false };

function setStatus(message) {
  statusElement.textContent = message;
}

function showStorageWarning(message) {
  const warning = document.getElementById("storage-warning");
  warning.textContent = message;
  warning.hidden = false;
}

function saveState() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    showStorageWarning(
      "This browser could not save your notes. Open Review notes and export them before closing.",
    );
  }
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (
      saved &&
      Array.isArray(saved.notes) &&
      typeof saved.progress === "object" &&
      saved.progress !== null
    ) {
      if (saved.notes.some((note) => !validNote(note))) throw new Error("Invalid saved note.");
      state.notes = saved.notes;
      state.progress = saved.progress;
      state.showProposals = saved.showProposals === true;
    }
  } catch {
    showStorageWarning(
      "Saved notes could not be read. Open Review notes to import an exported copy.",
    );
  }
  for (const proposal of report.proposals) {
    if (state.notes.some((note) => note.id === "proposal-" + proposal.id)) continue;
    const evidence = report.evidence.find((item) => item.id === proposal.evidence);
    const pull = report.pulls.find((item) => item.id === proposal.pr);
    const fileIndex = pull.files.findIndex(
      (file) => (evidence.side === "BASE" ? file.oldPath : file.path) === evidence.path,
    );
    const rowIndex =
      fileIndex < 0
        ? -1
        : pull.files[fileIndex].rows.findIndex(
            (row) => (evidence.side === "BASE" ? row.oldLine : row.newLine) === evidence.start,
          );
    const anchor =
      rowIndex < 0
        ? "group-" + proposal.group
        : "diff-" + proposal.pr + "-" + fileIndex + "-" + rowIndex;
    state.notes.push({
      id: "proposal-" + proposal.id,
      author: "agent",
      pr: proposal.pr,
      anchor,
      body: proposal.body,
      originalBody: proposal.body,
      quote: evidence.text,
      selected: false,
      dismissed: false,
      source: {
        path: evidence.path,
        side: evidence.side,
        start: evidence.start,
        end: evidence.end,
      },
      evidence: [proposal.evidence],
      reason: proposal.reason,
      verification: proposal.verification,
      counterevidence: proposal.counterevidence,
    });
  }
}

function exportNotes() {
  const payload = {
    version: 1,
    reportId: report.reportId,
    pulls: report.pulls.map((pull) => ({
      id: pull.id,
      repository: pull.repository,
      number: pull.number,
      baseSha: pull.baseSha,
      headSha: pull.headSha,
    })),
    notes: state.notes,
    progress: state.progress,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "review-notes-" + report.reportId.slice(0, 12) + ".json";
  link.click();
  URL.revokeObjectURL(link.href);
  setStatus("Notes exported. The file contains your notes and their PR references.");
}

function selectedNotes() {
  return state.notes.filter(
    (note) =>
      note.selected &&
      !note.dismissed &&
      (note.author === "human" || state.showProposals) &&
      note.pr === document.getElementById("draft-pr").value,
  );
}
