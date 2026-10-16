import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { build, embedded, fixture } from "./guidedFixture.js";

test("the builder refuses a guide that does not say what the change does", async () => {
  const context = await fixture();
  const [, secondPull] = context.input.pulls;
  if (!secondPull) throw new Error("The fixture needs a second PR.");
  context.input.overview.approach = " ";
  secondPull.role = "";
  await writeFile(context.inputPath, JSON.stringify(context.input));
  expect(build(context)).toMatchObject({
    exitCode: 1,
    error: "The overview needs text for overview.approach, the role of PR #2.\n",
  });
  expect(await Bun.file(context.outputPath).exists()).toBeFalse();
});

test("a one-PR guide needs the overview but no PR role", async () => {
  const context = await fixture();
  const [firstPull] = context.input.pulls;
  const [group] = context.input.groups;
  if (!firstPull || !group) throw new Error("The fixture needs a PR and a reading group.");
  const input = {
    ...context.input,
    pulls: [{ ...firstPull, role: undefined }],
    groups: [
      { ...group, prs: ["pr-1"], files: group.files.filter((file) => file.pr === "pr-1") },
    ],
  };
  await writeFile(context.inputPath, JSON.stringify(input));
  expect(build(context).exitCode).toBe(0);
  const html = await Bun.file(context.outputPath).text();
  expect(html).toContain(context.input.overview.problem);
  expect(html).not.toContain("What each PR adds");
});

test("the guide opens on the overview, with each PR role, before the first reading step", async () => {
  const context = await fixture();
  expect(build(context).exitCode).toBe(0);
  const document = await Bun.file(context.outputPath).text();
  expect(embedded(document)).toMatchObject({
    overview: context.input.overview,
    pulls: context.input.pulls.map((pull) => ({ id: pull.id, role: pull.role })),
  });
  const [html] = document.split('<script type="application/json"');
  if (!html) throw new Error("The guide needs visible content.");
  const guide = html.slice(html.indexOf('<div id="guide">'));
  const pages = [...guide.matchAll(/<article [^>]*>/g)].map((match) => match[0]);
  expect(pages).toEqual([
    '<article class="reading-step overview-page" id="step-overview">',
    '<article class="reading-step" id="step-flow" data-group="flow" hidden>',
  ]);
  const { problem, outcome, approach } = context.input.overview;
  const readingOrder = [
    problem,
    outcome,
    approach,
    ...context.input.pulls.map((pull) => pull.role),
    "One run of the job callback.",
    'id="step-flow"',
  ].map((text) => guide.indexOf(text));
  expect(readingOrder.every((position) => position > 0)).toBeTrue();
  expect(readingOrder).toEqual([...readingOrder].sort((first, second) => first - second));
  const route = [...html.matchAll(/<button class="route-step" data-step="(\d+)"/g)].map(
    (match) => match[1],
  );
  expect(route).toEqual(["0", "1"]);
  expect(html).toContain("What this change does<small>Start here · 3 PRs</small>");
});
