import { expect, test } from "bun:test";
import { writeActiveEnvironment } from "@shadowclone/environment/testing";
import { bunTaskList, harnessTestSetup } from "@shadowclone/harness/testing";
import { harnessSyncCommand } from "../harnessSync";
import { init, read, rules } from "./initFixture";

test("sync refreshes an initialized repository harness with the current learned rules", async () => {
  const setup = await harnessTestSetup({ fixture: bunTaskList, globalRules: rules });

  await init(setup);
  await writeActiveEnvironment({
    paths: setup.paths,
    home: setup.home,
    bodies: [...rules, "Plan before editing more than three files."],
  });

  expect(
    await harnessSyncCommand({
      apply: true,
      cwd: setup.root,
      paths: setup.paths,
      managedConfigPath: null,
      ask: () => true,
      writeLine: () => undefined,
    }),
  ).not.toBeNull();
  expect(await read(setup, "AGENTS.md")).toContain("- Plan before editing more than three files.");
});
