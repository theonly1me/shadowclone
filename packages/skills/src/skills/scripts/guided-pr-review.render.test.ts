import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build, embedded, fixture, skillDirectory } from "./guidedFixture.js";

test("saving updates only the original HTML and refuses a changed file or another review", async () => {
  const context = await fixture();
  expect(build(context).exitCode).toBe(0);
  const scriptPath = path.join(context.directory, "save.mjs");
  const script = `import { readFile, writeFile } from 'node:fs/promises';
    import { writeAnnotations } from ${JSON.stringify(pathToFileURL(path.join(skillDirectory, "assets/document.mjs")))};
    const path = ${JSON.stringify(context.outputPath)};
    const html = await readFile(path, 'utf8');
    const review = JSON.parse(/id="review-data">([\\s\\S]*?)<\\/script>/.exec(html)[1]);
    const annotations = { ...review.annotations, revision: 1, notes: [{ id: 'human', pr: 'pr-1', anchor: 'flow:summary', quote: 'PR 1 changes retries.', ranges: [], body: '</script> My question', originalBody: '</script> My question', dismissed: false }], decisions: { 'agent-1': 'dismissed' } };
    let pending;
    const handle = { getFile: async () => ({ text: () => readFile(path, 'utf8') }), createWritable: async () => ({ write: async text => { pending = text; }, close: () => writeFile(path, pending), abort: async () => { pending = undefined; } }) };
    const options = { handle, id: review.id, previous: null, expected: review.annotations, annotations };
    const saved = await writeAnnotations(options);
    console.log(saved.replace(/id="review-data">[\\s\\S]*?<\\/script>/, '') === html.replace(/id="review-data">[\\s\\S]*?<\\/script>/, ''));
    await writeFile(path, saved + '\\nExternal edit');
    try { await writeAnnotations({ ...options, previous: saved }); } catch (error) { console.log(error.message); }
    try { await writeAnnotations({ ...options, id: 'another' }); } catch (error) { console.log(error.message); }
    try { await writeAnnotations(options); } catch (error) { console.log(error.message); }
    const denied = { ...handle, createWritable: async () => { throw new Error('Permission denied'); } };
    try { await writeAnnotations({ ...options, handle: denied, expected: annotations }); } catch (error) { console.log(error.message); }
    console.log((await readFile(path, 'utf8')).endsWith('External edit'));`;
  await writeFile(scriptPath, script);
  const result = Bun.spawnSync([process.execPath, scriptPath], { stdout: "pipe", stderr: "pipe" });
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString().trim().split("\n")).toEqual([
    "true",
    "The HTML changed outside this page. Your unsaved notes are preserved.",
    "This file belongs to another review.",
    "The file's notes changed outside this page. Reopen it before saving.",
    "Permission denied",
    "true",
  ]);
  expect(embedded(await Bun.file(context.outputPath).text())).toMatchObject({
    annotations: {
      revision: 1,
      notes: [expect.objectContaining({ body: "</script> My question", dismissed: false })],
      decisions: { "agent-1": "dismissed" },
    },
  });
});
