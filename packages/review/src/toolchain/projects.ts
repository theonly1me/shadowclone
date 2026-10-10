import path from "node:path";
import { stackContext } from "./context";
import type { Stack, StackContext } from "./types";

export const maximumProjectsPerStack = 3;

export type StackProject = { readonly stack: Stack; readonly directory: string };

export function filesUnder(options: { readonly directory: string; readonly files: readonly string[] }): readonly string[] {
  if (options.directory === "") {
    return options.files;
  }

  const prefix = `${options.directory}/`;

  return options.files.filter((file) => file.startsWith(prefix)).map((file) => file.slice(prefix.length));
}

export function projectContext(options: { readonly root: string; readonly directory: string; readonly changedFiles: readonly string[] }): StackContext {
  return stackContext({ root: path.join(options.root, options.directory), changedFiles: filesUnder({ directory: options.directory, files: options.changedFiles }) });
}

function ancestors(file: string): readonly string[] {
  const directories: string[] = [];

  for (let directory = path.posix.dirname(file); directory !== "." && directory !== "/"; directory = path.posix.dirname(directory)) {
    directories.push(directory);
  }

  return directories;
}

function nearestProject(options: { readonly stack: Stack; readonly root: string; readonly file: string; readonly changedFiles: readonly string[] }): string | null {
  return ancestors(options.file).find((directory) => options.stack.detect(projectContext({ root: options.root, directory, changedFiles: options.changedFiles }))) ?? null;
}

export function stackProjects(options: { readonly stacks: readonly Stack[]; readonly root: string; readonly changedFiles: readonly string[] }): readonly StackProject[] {
  return options.stacks.flatMap((stack) => {
    const sources = options.changedFiles.filter((file) => stack.sources.test(file));

    if (sources.length === 0) {
      return [];
    }

    if (stack.detect(projectContext({ root: options.root, directory: "", changedFiles: options.changedFiles }))) {
      return [{ stack, directory: "" }];
    }

    const counts = new Map<string, number>();

    for (const file of sources) {
      const directory = nearestProject({ stack, root: options.root, file, changedFiles: options.changedFiles });

      if (directory !== null) {
        counts.set(directory, (counts.get(directory) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, maximumProjectsPerStack)
      .map(([directory]) => ({ stack, directory }));
  });
}
