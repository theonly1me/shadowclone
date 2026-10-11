export function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  );
}

export function safeUrl(value) {
  return /^(?:https?:\/\/|#)/i.test(value) ? value : null;
}

export function sourceUrl(options) {
  return (
    "https://github.com/" +
    options.repository +
    "/blob/" +
    options.sha +
    "/" +
    options.path.split("/").map(encodeURIComponent).join("/") +
    "#L" +
    options.start +
    (options.end > options.start ? "-L" + options.end : "")
  );
}

export function jsonForHtml(value) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}
