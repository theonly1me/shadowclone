import { expect, test } from "bun:test";
import { skillDirectory } from "./guidedFixture.js";
import { pathToFileURL } from "node:url";
import path from "node:path";

test("Markdown rendering preserves headings and code while escaping source HTML", () => {
  const text = "# After\n**Three** attempts.\n- Keep `state`.\n<script>unsafe()</script>";
  const script = `import { markdown, jsonForHtml } from ${JSON.stringify(pathToFileURL(path.join(skillDirectory, "scripts/format.mjs")))};
    console.log(markdown(${JSON.stringify(text)}));
    console.log(jsonForHtml({ body: '</script><script>unsafe()</script>' }));`;
  const result = Bun.spawnSync([process.execPath, "--eval", script], {
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain(
    "<h1>After</h1><p><strong>Three</strong> attempts.</p><ul><li>Keep <code>state</code>.</li></ul><p>&lt;script&gt;unsafe()&lt;/script&gt;</p>",
  );
  expect(result.stdout.toString()).toContain(
    '"body":"\\u003c/script>\\u003cscript>unsafe()\\u003c/script>"',
  );
});

test("source metadata cannot create HTML elements inside the code view", () => {
  const script = `import { fileMarkup } from ${JSON.stringify(pathToFileURL(path.join(skillDirectory, "scripts/format.mjs")))};
    const marker = '"><img id=unexpected-image>';
    console.log(fileMarkup({
      file: { id: 'evidence:source', pr: 'pr-1', path: 'job.ts', rows: [{ kind: 'context', side: 'HEAD', text: 'real source', oldLine: 1, newLine: 1, owner: 'pr-1' }] },
      pulls: [{ id: 'pr-1', number: 1 }], sha: { HEAD: marker }
    }));`;
  const result = Bun.spawnSync([process.execPath, "--eval", script], {
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).not.toContain("<img id=unexpected-image>");
  expect(result.stdout.toString()).toContain(
    'data-sha="&quot;&gt;&lt;img id=unexpected-image&gt;"',
  );
  expect(result.stdout.toString()).toContain("<code>real source</code>");
});
