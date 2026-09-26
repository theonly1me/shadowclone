import path from "node:path";
import { readLocalText } from "../localFiles";
import {
  archiveClaudeMemory,
  migrateClaudeMemory,
  parseClaudeMemoryDecisions,
  type ClaudeMemoryDecisions,
  type ClaudeMemoryMigrationResult,
} from "../migrate";
import { projectPaths } from "../paths";
import { promptConfirmation, type ConfirmPrompt } from "./confirm";

type MigrationOptions = {
  readonly apply: boolean;
  readonly archive: boolean;
  readonly decisionsPath: string | null;
  readonly revisionId: string | null;
};

function parseOptions(arguments_: readonly string[]): MigrationOptions | null {
  let apply = false;
  let archive = false;
  let decisionsPath: string | null = null;
  let revisionId: string | null = null;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--apply" && !apply) {
      apply = true;
      continue;
    }
    if (argument === "--archive-source" && !archive) {
      archive = true;
      continue;
    }
    if (argument === "--revision" && revisionId === null) {
      const value = arguments_[index + 1];
      if (value === undefined) return null;
      revisionId = value;
      index += 1;
      continue;
    }
    if (argument === "--decisions" && decisionsPath === null) {
      const value = arguments_[index + 1];
      if (value === undefined) return null;
      decisionsPath = path.resolve(value);
      index += 1;
      continue;
    }
    return null;
  }
  if (archive && (apply || decisionsPath !== null || revisionId === null)) return null;
  if (!archive && revisionId !== null) return null;
  return { apply, archive, decisionsPath, revisionId };
}

async function readDecisions(filePath: string | null): Promise<ClaudeMemoryDecisions | undefined> {
  if (filePath === null) return undefined;
  const text = await readLocalText(filePath);
  if (text === null) throw new Error("Claude memory decisions file was not found");
  return parseClaudeMemoryDecisions(text);
}

export function renderMigrationResult(result: ClaudeMemoryMigrationResult): string {
  const counts = Map.groupBy(result.plan.manifest.files, (file) => file.disposition);
  const lines = [
    `Claude memory migration: ${result.plan.manifest.files.length} file(s).`,
    ...[...counts].sort(([left], [right]) => left.localeCompare(right)).map(
      ([disposition, files]) => `  ${disposition}: ${files.length}`,
    ),
    ...(result.plan.reviewRequired.length === 0
      ? []
      : [
          "Feedback requiring reviewed dispositions:",
          ...result.plan.reviewRequired.map((filename) => `  ${filename}`),
        ]),
  ];
  if (result.plan.alreadyApplied) lines.push("This source snapshot was already migrated.");
  else if (result.revisionId !== null) lines.push(`Applied revision ${result.revisionId}.`);
  else lines.push("Preview only. Use --decisions <file> --apply after reviewing feedback.");
  return `${lines.join("\n")}\n`;
}

export async function handleMigrateCommand(options: {
  readonly command: string | undefined;
  readonly arguments: readonly string[];
  readonly confirm?: ConfirmPrompt;
}): Promise<boolean> {
  if (options.command !== "migrate" || options.arguments[0] !== "claude-memory") {
    return false;
  }
  const parsed = parseOptions(options.arguments.slice(1));
  if (parsed === null) {
    throw new Error("Use shadowclone migrate claude-memory [--decisions <file>] [--apply] or --archive-source --revision <id>");
  }
  if (parsed.archive && parsed.revisionId !== null) {
    const confirm = options.confirm ?? promptConfirmation;
    if (!(await confirm(
      "Archive migrated feedback and reference files from active Claude memory after creating a verified sibling backup?",
    ))) {
      await Bun.stdout.write("Claude memory source was not changed.\n");
      return true;
    }
    const result = await archiveClaudeMemory({
      paths: projectPaths,
      revisionId: parsed.revisionId,
    });
    await Bun.stdout.write(
      `Archived ${result.archived} file(s); ${result.activeProjects} project note(s) remain. Backup: ${result.backupDirectory}\n`,
    );
    return true;
  }
  const result = await migrateClaudeMemory({
    paths: projectPaths,
    cwd: process.cwd(),
    apply: parsed.apply,
    decisions: await readDecisions(parsed.decisionsPath),
  });
  await Bun.stdout.write(renderMigrationResult(result));
  return true;
}
