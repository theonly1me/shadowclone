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
