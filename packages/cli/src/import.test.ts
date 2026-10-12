import { expect, test } from "bun:test";
import { mkdir, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { defaultManagedPolicy, readConfig, createProjectPaths } from "@shadowclone/core";
import { emptyEnvironment, environmentFile, writeEnvironment } from "@shadowclone/environment";
import { importRepositoryGuidanceCommand } from "./import";

async function testContext(): Promise<{
  readonly repository: string;
  readonly paths: ReturnType<typeof createProjectPaths>;
}> {
  const homeDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-import-home-"),
  );
  const repository = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-import-repo-"),
  );

  const paths = createProjectPaths({ homeDirectory, platform: "darwin" });

  await writeEnvironment({
    paths,
    state: { ...emptyEnvironment, phase: "active", baselineDirectory: homeDirectory },
  });

  return { repository, paths };
}

test("declining import leaves configuration and the learning store untouched", async () => {
  const { repository, paths } = await testContext();
  const before = await Bun.file(environmentFile(paths)).text();

  await mkdir(path.join(repository, "CLAUDE.md"));

  const result = await importRepositoryGuidanceCommand({
    paths,
    configPath: paths.configFile,
    workingDirectory: repository,
    managedPolicy: defaultManagedPolicy,
    ask: () => false,
    writeLine: () => {},
  });

  expect(result).toBeNull();
  expect(await Bun.file(paths.configFile).exists()).toBeFalse();
  expect(await Bun.file(environmentFile(paths)).text()).toBe(before);
});

test("persists consent and imports only redacted repository guidance", async () => {
  const { repository, paths } = await testContext();
  const secret = ["sk", "abcdefghijklmnop123456"].join("-");
  const skillPath = path.join(
    repository,
    ".claude",
    "skills",
    "private-review",
    "SKILL.md",
  );

  await mkdir(path.dirname(skillPath), { recursive: true });
  await Bun.write(
    skillPath,
    `---\nname: private-review\n---\n# Review ${secret}\n\nAPI_TOKEN=${secret}`,
  );

  const output: string[] = [];

  const result = await importRepositoryGuidanceCommand({
    paths,
    configPath: paths.configFile,
    workingDirectory: repository,
    managedPolicy: defaultManagedPolicy,
    ask: () => true,
    writeLine: (line) => output.push(line),
  });

  const config = await readConfig({ configPath: paths.configFile });
  const persisted = await Bun.file(environmentFile(paths)).text();

  expect(result?.imported).toBe(1);
  expect(config.sources["declared-rules"]).toBeTrue();
  expect(persisted).not.toContain(secret);
  expect(persisted).toContain("[redacted:");
  expect(output).toEqual([
    "Imported 1 repository guidance files; 0 preserved; 0 rejected; 0 retired.",
  ]);
  expect(output.join("\n")).not.toContain("SKILL.md");
  expect(output.join("\n")).not.toContain("private-review");
});

test("does not prompt again after repository guidance consent", async () => {
  const { repository, paths } = await testContext();

  await Bun.write(path.join(repository, "AGENTS.md"), "Keep changes focused.");

  let prompts = 0;
  const options = {
    paths,
    configPath: paths.configFile,
    workingDirectory: repository,
    managedPolicy: defaultManagedPolicy,
    ask: () => {
      prompts += 1;

      return true;
    },
    writeLine: () => {},
  };

  await importRepositoryGuidanceCommand(options);
  await importRepositoryGuidanceCommand(options);

  expect(prompts).toBe(1);
});

test("managed policy blocks import before configuration is read", async () => {
  const { repository, paths } = await testContext();
  const policy = {
    ...defaultManagedPolicy,
    allowedSources: defaultManagedPolicy.allowedSources.filter(
      (source) => source !== "declared-rules",
    ),
  };

  await expect(
    importRepositoryGuidanceCommand({
      paths,
      configPath: repository,
      workingDirectory: repository,
      managedPolicy: policy,
      ask: () => true,
      writeLine: () => {},
    }),
  ).rejects.toThrow("Managed policy blocks repository guidance import");
});
