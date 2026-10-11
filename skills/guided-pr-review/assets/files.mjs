function codeLines(options) {
  return options.text
    .split("\n")
    .map(
      (text, index) =>
        '<div class="source-line"><span class="line-number">' +
        (index + 1) +
        "</span><code>" +
        escapeHtml(text) +
        "</code></div>",
    )
    .join("");
}

function fileView(options) {
  const { file, view, pr, index } = options;
  if (view !== "diff") {
    const text = view === "base" ? file.base : file.head;
    if (text === null)
      return '<p class="muted">This side has no text content. The file is absent or binary.</p>';
    return /\.md$/i.test(file.path)
      ? '<div class="markdown-view">' + renderMarkdown(text) + "</div>"
      : '<div class="source-code">' + codeLines({ text }) + "</div>";
  }
  if (file.binary)
    return (
      '<p class="muted">Binary change. Inspect the source file through the PR.</p><pre>' +
      escapeHtml(file.diff) +
      "</pre>"
    );
  if (!file.rows.some((row) => row.kind !== "header"))
    return (
      '<p class="muted">This change has no text hunks. Inspect the file metadata and source views.</p><pre>' +
      escapeHtml(file.diff) +
      "</pre>"
    );
  return (
    '<div class="diff-code">' +
    file.rows
      .map((row, rowIndex) => {
        if (row.kind === "header" && !row.text.startsWith("@@")) return "";
        const side = row.kind === "remove" ? "BASE" : "HEAD";
        const line = side === "BASE" ? row.oldLine : row.newLine;
        const context =
          line === null
            ? ""
            : ' data-line="' +
              line +
              '" data-side="' +
              side +
              '" data-pr="' +
              pr +
              '" data-path="' +
              escapeHtml(side === "BASE" ? file.oldPath : file.path) +
              '" data-anchor="diff-' +
              pr +
              "-" +
              index +
              "-" +
              rowIndex +
              '"';
        const button =
          line === null
            ? ""
            : '<button class="line-note" type="button" aria-label="Add note on line ' +
              line +
              '">＋</button>';
        return (
          '<div class="diff-line ' +
          row.kind +
          '"' +
          context +
          ">" +
          button +
          '<span class="line-number">' +
          (row.oldLine ?? "") +
          '</span><span class="line-number">' +
          (row.newLine ?? "") +
          "</span><code>" +
          escapeHtml(row.text) +
          "</code></div>" +
          (line === null
            ? ""
            : '<div class="note-list" data-notes-for="diff-' +
              pr +
              "-" +
              index +
              "-" +
              rowIndex +
              '"></div>')
        );
      })
      .join("") +
    "</div>"
  );
}

function loadFile(options) {
  const { element, view = "diff" } = options;
  const pull = report.pulls.find((item) => item.id === element.dataset.filePr);
  const index = Number(element.dataset.fileIndex);
  const file = pull?.files[index];
  if (!file) return;
  element.dataset.loaded = "true";
  element.querySelector(".file-content").innerHTML = fileView({ file, view, pr: pull.id, index });
  renderNotes();
  const focus = Number(element.dataset.focusLine);
  const line = element.querySelector('[data-line="' + focus + '"][data-side="HEAD"]');
  const content = element.querySelector(".file-content");
  if (view === "diff" && line) content.scrollTop = line.offsetTop - content.offsetTop;
  element
    .querySelectorAll("[data-file-view]")
    .forEach((button) => button.classList.toggle("active", button.dataset.fileView === view));
}

function connectFileViews() {
  document.querySelectorAll(".file-card").forEach((element) => {
    element.addEventListener("toggle", () => {
      if (
        element.open &&
        !element.closest(".group-section")?.hidden &&
        element.dataset.loaded !== "true"
      )
        loadFile({ element });
    });
  });
}

function loadOpenFiles() {
  document.querySelectorAll(".group-section:not([hidden]) .file-card[open]").forEach((element) => {
    if (element.dataset.loaded !== "true") loadFile({ element });
  });
}
