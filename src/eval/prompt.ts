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

function readContentText(content: unknown): string | null {
  if (typeof content === "string") {
    const match = content.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
    const text = (match?.[1] ?? content).trim();
    return text.length > 0 ? text : null;
  }
  if (!Array.isArray(content)) {
    return null;
  }
  const textBlock = content.find(isTextContentBlock);
  const text = textBlock ? textBlock.text.trim() : "";
  return text.length > 0 ? text : null;
}

export function extractPromptText(rawPrompt: string): string | null {
  try {
    const parsedValue: unknown = JSON.parse(rawPrompt);
    if (typeof parsedValue === "string") {
      const text = parsedValue.trim();
      return text.length > 0 ? text : null;
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
    const text = rawPrompt.trim();
    return text.length > 0 ? text : null;
  }
  const text = rawPrompt.trim();
  return text.length > 0 ? text : null;
}
