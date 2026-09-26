import path from "node:path";
import { canonicalPath, type ProjectPaths } from "../paths";

export function portableSkillDirectories(options: {
  readonly paths: ProjectPaths;
  readonly name: string;
}): readonly string[] {
  const home = path.dirname(options.paths.shadowcloneDirectory);
  return [
    path.join(home, ".agents/skills", options.name),
    path.join(home, ".claude/skills", options.name),
    path.join(home, ".cursor/skills", options.name),
    path.join(home, ".gemini/config/skills", options.name),
  ].map(canonicalPath);
}

export function redundantCodexSkillDirectory(options: {
  readonly paths: ProjectPaths;
  readonly name: string;
}): string {
  return canonicalPath(path.join(
    path.dirname(options.paths.codexSessionsDirectory),
    "skills",
    options.name,
  ));
}
