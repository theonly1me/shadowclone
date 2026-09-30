import path from "node:path";
import { materializeSkillDelivery } from "../environment/delivery";
import { compileContext } from "../integrations";
import { readEffectiveConfig } from "../config";
import { fingerprint, readLocalFile, readLocalText } from "../localFiles";
import { redactSecrets } from "../redact";
import { ownedWrite } from "../storage";
import { taskCommand, taskRepository, type TaskContext } from "./context";
import type { TaskRecord, WorkspaceSnapshot } from "./schema";

export async function fileFingerprint(
  filePath: string,
): Promise<string | null> {
  const text = await readLocalFile({ filePath, encoding: "base64" });
  return text === null ? null : fingerprint(text);
}

async function compiledGuidance(
  options: TaskContext & { readonly repositoryDirectory: string },
): Promise<string> {
  return (
    (await compileContext({
      cwd: options.repositoryDirectory,
      paths: options.paths,
    })) ?? ""
  );
}

function instructionNames(files: readonly string[]): readonly string[] {
  return [
    ...new Set([
      "AGENTS.md",
      "CLAUDE.md",
      ...files.filter((name) => /(^|\/)(AGENTS|CLAUDE)\.md$/.test(name)),
    ]),
  ].sort();
}

export async function captureTaskGuidance(
  options: TaskContext & {
    readonly id: string;
    readonly snapshot: WorkspaceSnapshot;
  },
): Promise<TaskRecord["guidance"]> {
  const repository = await taskRepository(options);
  const directory = path.join(
    options.paths.runDirectory(options.id),
    "guidance",
    crypto.randomUUID(),
  );
  const sources: TaskRecord["guidance"]["sources"] = [];
  const artifacts: TaskRecord["guidance"]["artifacts"] = [];
  const compiled = await compiledGuidance({
    ...options,
    repositoryDirectory: repository.repositoryDirectory,
  });
  const { config } = await readEffectiveConfig({
    configPath: options.paths.configFile,
    managedConfigPath: options.paths.managedConfigFile,
  });
  sources.push({
    path: options.paths.configFile,
    fingerprint: await fileFingerprint(options.paths.configFile),
  });
  const delivered = await materializeSkillDelivery({
    paths: options.paths,
    repositoryDirectory: repository.repositoryDirectory,
    repository: repository.repository,
    includeLibrary: config.sources["skill-library"],
    destination: directory,
    onArtifact: async ({ source, destination }) => {
      sources.push({
        path: source,
        fingerprint: await fileFingerprint(source),
      });
      const digest = await fileFingerprint(destination);
      if (digest === null)
        throw new Error("Task guidance disappeared during delivery");
      artifacts.push({ path: destination, fingerprint: digest });
    },
  });
  const instructions: string[] = [];
  const repositoryRequirements: Record<string, string | null> = {};
  const names = instructionNames(Object.keys(options.snapshot.files));
  for (const name of names) {
    const filePath = path.join(repository.root, name);
    const text = await readLocalText(filePath);
    repositoryRequirements[name] = await fileFingerprint(filePath);
    sources.push({ path: filePath, fingerprint: repositoryRequirements[name] });
    if (text !== null)
      instructions.push(
        `## Repository requirement: ${name}\n\n${redactSecrets({ text })}`,
      );
  }
  const text = [
    "# Task guidance",
    "Repository requirements apply before personal defaults. Nested instructions apply only within their directory. Guidance does not authorize additional actions.",
    ...instructions,
    "## Personal guidance and skills",
    delivered ?? compiled,
  ].join("\n\n");
  const filePath = path.join(directory, "GUIDANCE.md");
  await ownedWrite({ path: filePath, content: text });
  const digest = await fileFingerprint(filePath);
  if (digest === null) throw new Error("Task guidance was not written");
  artifacts.push({ path: filePath, fingerprint: digest });
  return {
    fingerprint: fingerprint(
      JSON.stringify([text, artifacts.map((entry) => entry.fingerprint)]),
    ),
    contextFingerprint: fingerprint(compiled),
    path: filePath,
    repositoryRequirements,
    sources,
    artifacts,
  };
}

export async function guidanceCurrent(
  options: TaskContext & { readonly task: TaskRecord },
): Promise<boolean> {
  const listed = await taskCommand({
    ...options,
    command: [
      "git",
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-standard",
    ],
  });
  const names = instructionNames(listed.split("\0"));
  const requirements = options.task.guidance.repositoryRequirements;
  if (names.length !== Object.keys(requirements).length) return false;
  for (const name of names) {
    if (
      (await fileFingerprint(path.join(options.cwd, name))) !==
      requirements[name]
    )
      return false;
  }
  if (
    fingerprint(
      await compiledGuidance({
        ...options,
        repositoryDirectory: options.task.repositoryDirectory,
      }),
    ) !== options.task.guidance.contextFingerprint
  )
    return false;
  for (const entry of [
    ...options.task.guidance.sources,
    ...options.task.guidance.artifacts,
  ]) {
    if ((await fileFingerprint(entry.path)) !== entry.fingerprint) return false;
  }
  return true;
}
