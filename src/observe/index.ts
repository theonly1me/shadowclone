import type { ShadowcloneConfig } from "../config";
import type { ProjectPaths } from "../paths";
import {
  discoverAntigravityFiles,
  observeAntigravityFile,
} from "./adapters/antigravity";
import {
  discoverClaudeCodeFiles,
  observeClaudeCodeFile,
} from "./adapters/claudeCode";
import { observeClaudePromptsFile } from "./adapters/claudePrompts";
import {
  discoverCodexFiles,
  observeCodexFile,
} from "./adapters/codex";
import {
  discoverCursorFiles,
  observeCursorFile,
} from "./adapters/cursor";
import { observeShellFile } from "./adapters/shell";
import type {
  CursorLookup,
  ObservationBatch,
} from "./types";

export type {
  AgentEvent,
  AgentEventKind,
  CursorLookup,
  FileTextRef,
  FileCursor,
  ObservationBatch,
  SqliteTextRef,
  TextRef,
  ToolCall,
} from "./types";
export {
  parseTextRef,
  textRefKey,
} from "./types";

export async function* observeAll(options: {
  readonly config: ShadowcloneConfig;
  readonly paths: ProjectPaths;
  readonly getCursor: CursorLookup;
}): AsyncIterable<ObservationBatch> {
  if (options.config.sources.antigravity) {
    const sourcePaths = await discoverAntigravityFiles(
      options.paths.antigravityBrainDirectory,
    );
    for (const sourcePath of sourcePaths) {
      const batch = await observeAntigravityFile({
        sourcePath,
        cursor: await options.getCursor(sourcePath),
      });
      if (batch !== null) {
        yield batch;
      }
    }
  }

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

  if (options.config.sources.codex) {
    const sourcePaths = await discoverCodexFiles(
      options.paths.codexSessionsDirectory,
    );
    for (const sourcePath of sourcePaths) {
      const batch = await observeCodexFile({
        sourcePath,
        cursor: await options.getCursor(sourcePath),
      });
      if (batch !== null) {
        yield batch;
      }
    }
  }

  if (options.config.sources.cursor) {
    const sourcePaths = await discoverCursorFiles(
      options.paths.cursorChatsDirectory,
    );
    for (const sourcePath of sourcePaths) {
      const batch = await observeCursorFile({
        sourcePath,
        cursor: await options.getCursor(sourcePath),
      });
      if (batch !== null) {
        yield batch;
      }
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
