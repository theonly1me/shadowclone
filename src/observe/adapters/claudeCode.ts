import { readJsonLines } from "../cursor";
import {
  isRecord,
  readRecord,
  readString,
} from "../record";
import type {
  AgentEvent,
  AgentEventKind,
  FileCursor,
  ObservationBatch,
  TextRef,
  ToolCall,
} from "../types";
import { createClaudeBaseEvent } from "./claudeBase";
import { parseClaudeUser } from "./claudeUser";

function classifyTool(name: string): AgentEventKind {
  if (name === "ExitPlanMode") {
    return "plan-presented";
  }
  if (name === "AskUserQuestion") {
    return "question-asked";
  }
  return "tool-call";
}

function getTool(block: Readonly<Record<string, unknown>>): ToolCall | null {
  if (readString(block, "type") !== "tool_use") {
    return null;
  }

  const name = readString(block, "name");
  if (name === null) {
    return null;
  }

  return {
    toolUseId: readString(block, "id"),
    name,
  };
}

function getContentBlocks(
  message: Readonly<Record<string, unknown>>,
): readonly unknown[] {
  const content = message.content;
  return Array.isArray(content) ? content : [content];
}

function getTextRef(options: {
  readonly blocks: readonly unknown[];
  readonly block: Readonly<Record<string, unknown>>;
  readonly ref: TextRef;
}): TextRef | null {
  return options.blocks.length === 1 &&
    readString(options.block, "type") === "text"
    ? options.ref
    : null;
}

function parseAssistant(options: {
  readonly record: Readonly<Record<string, unknown>>;
  readonly message: Readonly<Record<string, unknown>>;
  readonly ref: TextRef;
}): readonly AgentEvent[] {
  const base = createClaudeBaseEvent(options);
  const blocks = getContentBlocks(options.message);
  const events: AgentEvent[] = [];

  for (const value of blocks) {
    if (!isRecord(value)) {
      continue;
    }

    const blockType = readString(value, "type");
    const tool = getTool(value);
    const kind =
      tool === null
        ? blockType === "thinking"
          ? "thinking"
          : "assistant-text"
        : classifyTool(tool.name);

    events.push({
      ...base,
      kind,
      tool,
      isError: false,
      textRef:
        kind === "assistant-text"
          ? getTextRef({ blocks, block: value, ref: options.ref })
          : null,
    });
  }

  return events;
}

function parseClaudeRecord(options: {
  readonly value: unknown;
  readonly ref: TextRef;
}): readonly AgentEvent[] {
  if (!isRecord(options.value)) {
    return [];
  }

  const message = readRecord(options.value, "message");
  if (message === null) {
    return [];
  }

  const type = readString(options.value, "type");
  if (type === "assistant") {
    return parseAssistant({ record: options.value, message, ref: options.ref });
  }
  if (type === "user") {
    return parseClaudeUser({
      record: options.value,
      message,
      ref: options.ref,
    });
  }
  return [];
}

export async function observeClaudeCodeFile(options: {
  readonly sourcePath: string;
  readonly cursor: FileCursor | null;
}): Promise<ObservationBatch | null> {
  const result = await readJsonLines(options);
  if (result === null) {
    return null;
  }

  return {
    source: "claude-code",
    sourcePath: options.sourcePath,
    events: result.values.flatMap(parseClaudeRecord),
    cursor: result.cursor,
    rescanned: result.rescanned,
    bytesRead: result.bytesRead,
  };
}

export async function discoverClaudeCodeFiles(
  projectsDirectory: string,
): Promise<readonly string[]> {
  const glob = new Bun.Glob("**/*.jsonl");
  const files: string[] = [];
  for await (const sourcePath of glob.scan({
    cwd: projectsDirectory,
    absolute: true,
    onlyFiles: true,
  })) {
    files.push(sourcePath);
  }
  return files.sort();
}
