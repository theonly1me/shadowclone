import type { ShadowcloneConfig } from "../config";
import type { ProjectPaths } from "../paths";
import {
  discoverClaudeCodeFiles,
  observeClaudeCodeFile,
} from "./adapters/claudeCode";
import { observeClaudePromptsFile } from "./adapters/claudePrompts";
import { observeShellFile } from "./adapters/shell";
import type {
  CursorLookup,
  ObservationBatch,
} from "./types";

export type {
  AgentEvent,
  AgentEventKind,
  CursorLookup,
  FileCursor,
  ObservationBatch,
  TextRef,
  ToolCall,
} from "./types";

export async function* observeAll(options: {
  readonly config: ShadowcloneConfig;
  readonly paths: ProjectPaths;
  readonly getCursor: CursorLookup;
}): AsyncIterable<ObservationBatch> {
  if (options.config.sources["claude-code"]) {
    const sourcePaths = await discoverClaudeCodeFiles(
      options.paths.claudeProjectsDirectory,
    );
    for (const sourcePath of sourcePaths) {
      const batch = await observeClaudeCodeFile({
        sourcePath,
        cursor: await options.getCursor(sourcePath),
      });
      if (batch !== null) {
        yield batch;
      }
    }
  }

  if (options.config.sources["claude-prompts"]) {
    const sourcePath = options.paths.claudePromptHistoryFile;
    const batch = await observeClaudePromptsFile({
      sourcePath,
      cursor: await options.getCursor(sourcePath),
    });
    if (batch !== null) {
      yield batch;
    }
  }

  if (options.config.sources.shell) {
    for (const sourcePath of options.paths.shellHistoryFiles) {
      const batch = await observeShellFile({
        sourcePath,
        cursor: await options.getCursor(sourcePath),
      });
      if (batch !== null) {
        yield batch;
      }
    }
  }
}
