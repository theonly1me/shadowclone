let activeGroup = report.groups[0]?.id ?? null;
let reviewingNotes = false;

function relevantGroups() {
  return report.groups.filter((group) => selectedPr === "stack" || group.prs.includes(selectedPr));
}

function showGroup(options) {
  const groups = relevantGroups();
  if (!groups.some((group) => group.id === options.id)) showPr("stack");
  activeGroup = options.id;
  reviewingNotes = false;
  updateNavigation();
  const section = document.getElementById("group-" + activeGroup);
  if (options.scroll !== false && section) {
    section.scrollIntoView({ behavior: "instant", block: "start" });
    section.querySelector("h2").focus({ preventScroll: true });
  }
}

function updateNavigation() {
  const groups = relevantGroups();
  const index = groups.findIndex((group) => group.id === activeGroup);
  document.getElementById("notes-panel").hidden = !reviewingNotes;
  document.getElementById("guide-intro").hidden = reviewingNotes;
  document.getElementById("file-inventory").hidden = reviewingNotes;
  document.querySelectorAll(".group-section").forEach((section) => {
    section.hidden = reviewingNotes || section.dataset.group !== activeGroup;
    const previous = section.querySelector('[data-step-move="-1"]');
    const next = section.querySelector('[data-step-move="1"]');
    previous.disabled = index <= 0;
    previous.textContent = index > 0 ? "← " + groups[index - 1].title : "First step";
    next.disabled = index === -1 || index >= groups.length - 1;
    next.textContent =
      index < groups.length - 1 && index !== -1 ? groups[index + 1].title + " →" : "Last step";
  });
  document.querySelectorAll("[data-guide-step]").forEach((link) => {
    const current = !reviewingNotes && link.dataset.guideStep === activeGroup;
    link.classList.toggle("active", current);
    if (current) link.setAttribute("aria-current", "step");
    else link.removeAttribute("aria-current");
  });
  loadOpenFiles();
  const reviewed = report.groups.filter((group) => state.progress[group.id] === true).length;
  document.getElementById("route-progress").textContent =
    reviewed + " of " + report.groups.length + " steps reviewed";
}

function showPr(id) {
  selectedPr = id;
  document
    .querySelectorAll("[data-pr-tab]")
    .forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.prTab === id)));
  document.querySelectorAll(".pr-summary,.inventory-pr").forEach((element) => {
    element.hidden = id !== "stack" && element.dataset.pr !== id;
  });
  if (!relevantGroups().some((group) => group.id === activeGroup))
    activeGroup = relevantGroups()[0]?.id ?? null;
  if (id !== "stack") document.getElementById("draft-pr").value = id;
  searchGuide(document.getElementById("guide-search").value);
  updateNavigation();
  updateDraftButton();
}

function openNotesPanel() {
  reviewingNotes = true;
  updateNavigation();
  document.getElementById("notes-panel").scrollIntoView({ block: "start" });
}

function revealProposals() {
  state.showProposals = !state.showProposals;
  saveState();
  renderNotes();
  document.getElementById("compare-proposals").textContent = state.showProposals
    ? "Hide agent proposals"
    : "Compare agent proposals";
}

function navigateStep(button) {
  const groups = relevantGroups();
  const index = groups.findIndex((group) => group.id === activeGroup);
  const next = groups[index + Number(button.dataset.stepMove)];
  if (next) showGroup({ id: next.id });
}

function showEvidence(link) {
  const id = link.hash.slice("#evidence-".length);
  const evidence = report.evidence.find((item) => item.id === id);
  if (!evidence) return;
  const pull = report.pulls.find((item) => item.id === evidence.pr);
  const url = sourceUrl({
    repository: pull.repository,
    sha: evidence.sha,
    path: evidence.path,
    start: evidence.start,
    end: evidence.end,
  });
  const lines = evidence.text
    .split("\n")
    .map(
      (text, index) =>
        '<div class="source-line"><span class="line-number">' +
        (evidence.start + index) +
        "</span><code>" +
        escapeHtml(text) +
        "</code></div>",
    )
    .join("");
  document.getElementById("evidence-reader-body").innerHTML =
    '<p><span class="badge">PR #' +
    pull.number +
    "</span> <code>" +
    escapeHtml(evidence.path) +
    '</code></p><p class="muted">' +
    evidence.side +
    " · lines " +
    evidence.start +
    " to " +
    evidence.end +
    " · commit " +
    evidence.sha.slice(0, 12) +
    '</p><div class="source-code">' +
    lines +
    '</div><a href="' +
    escapeHtml(url) +
    '" target="_blank" rel="noreferrer">Open pinned source on GitHub</a>';
  document.getElementById("evidence-reader").showModal();
}

function searchGuide(value) {
  const query = value.toLowerCase().trim();
  document.querySelectorAll(".route li").forEach((element) => {
    const relevant = selectedPr === "stack" || element.dataset.prs.split(",").includes(selectedPr);
    element.hidden =
      !relevant || (query !== "" && !element.textContent.toLowerCase().includes(query));
  });
}
