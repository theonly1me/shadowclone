import { isRecord } from "../observe/record";

export function extractPromptText(raw: string): string {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "string") {
      return parsed.trim();
    }
    if (isRecord(parsed)) {
      const content = parsed.content;
      if (typeof content === "string") {
        const match = content.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
        return match?.[1] ? match[1].trim() : content.trim();
      }
      if (Array.isArray(content)) {
        const textBlock = content.find(
          (item) =>
            isRecord(item) &&
            item.type === "text" &&
            typeof item.text === "string",
        );
        if (
          textBlock &&
          isRecord(textBlock) &&
          typeof textBlock.text === "string"
        ) {
          return textBlock.text.trim();
        }
      }
      if (isRecord(parsed.message)) {
        const messageContent = parsed.message.content;
        if (typeof messageContent === "string") {
          return messageContent.trim();
        }
        if (Array.isArray(messageContent)) {
          const textBlock = messageContent.find(
            (item) =>
              isRecord(item) &&
              item.type === "text" &&
              typeof item.text === "string",
          );
          if (
            textBlock &&
            isRecord(textBlock) &&
            typeof textBlock.text === "string"
          ) {
            return textBlock.text.trim();
          }
        }
      }
    }
  } catch {
    return raw.trim();
  }
  return raw.trim();
}
