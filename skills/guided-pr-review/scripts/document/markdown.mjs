import { escapeHtml, safeUrl } from "./html.mjs";

export function inlineMarkdown(text) {
  const code = [];
  let result = escapeHtml(text).replace(/`([^`]+)`/g, (_, content) => {
    code.push("<code>" + content + "</code>");
    return "\u0001" + (code.length - 1) + "\u0002";
  });
  result = result.replace(/!\[([^\]]*)\]\([^)]*\)/g, (_, label) => "[Image: " + label + "]");
  result = result.replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (_, label, href) => {
    const url = safeUrl(href);
    return url ? '<a href="' + url + '" target="_blank" rel="noreferrer">' + label + "</a>" : label;
  });
  result = result
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
  return result.replace(/\u0001(\d+)\u0002/g, (_, index) => code[Number(index)]);
}

export function renderMarkdown(text) {
  const lines = String(text ?? "").split("\n");
  const blocks = [];
  let position = 0;
  while (position < lines.length) {
    const line = lines[position] ?? "";
    if (!line.trim()) {
      position += 1;
      continue;
    }
    const fence = /^\s*(`{3,}|~{3,})\s*([\w-]*)/.exec(line);
    if (fence) {
      const content = [];
      position += 1;
      while (position < lines.length && !(lines[position] ?? "").trimStart().startsWith(fence[1]))
        content.push(lines[position++]);
      position += 1;
      blocks.push(
        '<pre class="markdown-code"><code>' + escapeHtml(content.join("\n")) + "</code></pre>",
      );
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push(
        "<h" +
          heading[1].length +
          ">" +
          inlineMarkdown(heading[2]) +
          "</h" +
          heading[1].length +
          ">",
      );
      position += 1;
      continue;
    }
    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      blocks.push("<hr>");
      position += 1;
      continue;
    }
    if (line.includes("|") && /^\s*\|?\s*:?-{3,}/.test(lines[position + 1] ?? "")) {
      const cells = (value) =>
        value
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((cell) => inlineMarkdown(cell.trim()));
      const headers = cells(line);
      position += 2;
      const rows = [];
      while (position < lines.length && (lines[position] ?? "").includes("|"))
        rows.push(cells(lines[position++]));
      blocks.push(
        '<div class="table-scroll"><table><thead><tr>' +
          headers.map((cell) => "<th>" + cell + "</th>").join("") +
          "</tr></thead><tbody>" +
          rows
            .map((row) => "<tr>" + row.map((cell) => "<td>" + cell + "</td>").join("") + "</tr>")
            .join("") +
          "</tbody></table></div>",
      );
      continue;
    }
    if (/^\s*(?:[-*+] |\d+\. )/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items = [];
      while (position < lines.length && /^\s*(?:[-*+] |\d+\. )/.test(lines[position] ?? "")) {
        const content = (lines[position++] ?? "").replace(/^\s*(?:[-*+] |\d+\. )/, "");
        items.push("<li>" + inlineMarkdown(content) + "</li>");
      }
      blocks.push((ordered ? "<ol>" : "<ul>") + items.join("") + (ordered ? "</ol>" : "</ul>"));
      continue;
    }
    if (/^> ?/.test(line)) {
      blocks.push("<blockquote>" + inlineMarkdown(line.replace(/^> ?/, "")) + "</blockquote>");
      position += 1;
      continue;
    }
    const paragraph = [line];
    position += 1;
    while (
      position < lines.length &&
      (lines[position] ?? "").trim() &&
      !/^(?:#|>|`{3}|~{3}|[-*+] |\d+\. )/.test(lines[position] ?? "")
    )
      paragraph.push(lines[position++]);
    blocks.push("<p>" + inlineMarkdown(paragraph.join("\n")).replaceAll("\n", "<br>") + "</p>");
  }
  return blocks.join("\n");
}
