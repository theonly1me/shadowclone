import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fingerprint } from "@shadowclone/core";
import { checkoutRoot } from "@shadowclone/core/testing";
import { emptyEnvironment, readEnvironment, writeEnvironment } from "@shadowclone/environment";
import { learningRecord, skillFixture } from "@shadowclone/environment/testing";

async function runSync(options: { readonly home: string; readonly replaceEdited?: boolean }) {
  const child = Bun.spawn(
    [
      process.execPath,
      path.join(import.meta.dir, "main.ts"),
      "sync",
      ...(options.replaceEdited ? ["--replace-edited"] : []),
    ],
    {
      cwd: await checkoutRoot(),
      env: { ...process.env, HOME: options.home },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [output, error, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { output, error, exitCode };
}

test("sync reports a preserved catalog and --replace-edited replaces it", async () => {
  const setup = await skillFixture();
  try {
    await writeEnvironment({
      paths: setup.paths,
      state: {
        ...emptyEnvironment,
        phase: "active",
        records: [learningRecord()],
        artifacts: [
          {
            kind: "skill",
            filePath: setup.filePath,
            fingerprint: fingerprint(setup.original),
            original: null,
            scope: "global",
            name: "typed-changes",
            description: "Use when editing typed code.",
            learningKeys: ["palette-validation"],
          },
        ],
      },
    });
    expect((await runSync({ home: setup.home })).exitCode).toBe(0);
    const catalog = path.join(setup.home, ".agents/skills/shadowclone-guidance/catalog.md");
    const edited = "Keep this manually authored catalog.\n";
    await Bun.write(catalog, edited);
    const preserved = await runSync({ home: setup.home });
    expect(preserved.error).toBe("");
    expect(preserved.exitCode).toBe(1);
    expect(preserved.output).toContain(`Preserved task catalog ${catalog}`);
    expect(preserved.output).toContain("shadowclone sync --replace-edited");
    expect(preserved.output.trim().split("\n").at(-1)).toContain("Preserved 1 task catalog.");
    expect(await Bun.file(catalog).text()).toBe(edited);

    const replaced = await runSync({ home: setup.home, replaceEdited: true });
    expect(replaced.error).toBe("");
    expect(replaced.exitCode).toBe(0);
    expect(replaced.output).toContain(`Replaced task catalog ${catalog}.`);
    expect(replaced.output.trim().split("\n").at(-1)).toBe(
      "Synchronized learned skills and native routing.",
    );
    const text = await Bun.file(catalog).text();
    expect(text).toContain("# Task guidance catalog");
    expect(
      (await readEnvironment(setup.paths))?.artifacts.find(
        (artifact) => artifact.filePath === catalog,
      )?.fingerprint,
    ).toBe(fingerprint(text));
  } finally {
    await rm(setup.home, { recursive: true, force: true });
  }
});
