import { isRecord } from "../observe/record";

type TextContentBlock = {
  readonly type: string;
  readonly text: string;
};

function isTextContentBlock(value: unknown): value is TextContentBlock {
  return (
    isRecord(value) &&
    value.type === "text" &&
    typeof value.text === "string"
  );
}

export function stripLeadingSlashCommands(prompt: string): string {
  return prompt
    .replace(/^(\s*\/[a-zA-Z0-9_-]+(?::|,)?(?:\s+|$))+/, "")
    .trim();
}

function cleanPrompt(text: string): string | null {
  const cleaned = stripLeadingSlashCommands(text);
  return cleaned.length > 0 ? cleaned : null;
}

function readContentText(content: unknown): string | null {
  if (typeof content === "string") {
    const match = content.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
    const text = (match?.[1] ?? content).trim();
    return cleanPrompt(text);
  }
  if (!Array.isArray(content)) {
    return null;
  }
  const textBlock = content.find(isTextContentBlock);
  const text = textBlock ? textBlock.text.trim() : "";
  return cleanPrompt(text);
}

export function extractPromptText(rawPrompt: string): string | null {
  try {
    const parsedValue: unknown = JSON.parse(rawPrompt);
    if (typeof parsedValue === "string") {
      return cleanPrompt(parsedValue);
    }
    if (isRecord(parsedValue)) {
      const fromContent = readContentText(parsedValue.content);
      if (fromContent !== null) {
        return fromContent;
      }
      if (isRecord(parsedValue.message)) {
        const fromMessage = readContentText(parsedValue.message.content);
        if (fromMessage !== null) {
          return fromMessage;
        }
      }
      return null;
    }
  } catch {
    return cleanPrompt(rawPrompt);
  }
  return cleanPrompt(rawPrompt);
}
