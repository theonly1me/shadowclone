import path from "node:path";

type MockBlock =
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, string>;
    }
  | { type: "text"; text: string };

export function mockMessage(options: {
  directory: string;
  request: number;
  stream: boolean;
}): Response {
  const skill = path.join(options.directory, "skills/clean-code/SKILL.md");

  const content: MockBlock[] =
    options.request === 1
      ? [
          {
            type: "tool_use",
            id: "toolu_read_before",
            name: "Read",
            input: { file_path: skill },
          },
          {
            type: "tool_use",
            id: "toolu_missing",
            name: "Read",
            input: { file_path: path.join(options.directory, "missing.md") },
          },
        ]
      : options.request === 2
        ? [
            {
              type: "tool_use",
              id: "toolu_write",
              name: "Write",
              input: {
                file_path: path.join(options.directory, "result.ts"),
                content: "export const completeName = true;\n",
              },
            },
          ]
        : options.request === 3
          ? [
              {
                type: "tool_use",
                id: "toolu_read_after",
                name: "Read",
                input: { file_path: skill },
              },
            ]
          : [{ type: "text", text: "Synthetic stream contract complete." }];

  const message = {
    id: `msg_synthetic_${options.request}`,
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5",
    content,
    stop_reason: options.request < 4 ? "tool_use" : "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  };

  if (!options.stream) {
    return Response.json(message);
  }

  const frames: { type: string; [key: string]: unknown }[] = [
    {
      type: "message_start",
      message: {
        ...message,
        content: [],
        stop_reason: null,
        usage: { input_tokens: 1, output_tokens: 0 },
      },
    },
  ];

  for (const [index, block] of content.entries()) {
    frames.push({
      type: "content_block_start",
      index,
      content_block:
        block.type === "tool_use"
          ? { ...block, input: {} }
          : { type: "text", text: "" },
    });
    frames.push({
      type: "content_block_delta",
      index,
      delta:
        block.type === "tool_use"
          ? {
              type: "input_json_delta",
              partial_json: JSON.stringify(block.input),
            }
          : { type: "text_delta", text: block.text },
    });
    frames.push({ type: "content_block_stop", index });
  }

  frames.push({
    type: "message_delta",
    delta: { stop_reason: message.stop_reason, stop_sequence: null },
    usage: { output_tokens: 1 },
  });
  frames.push({ type: "message_stop" });

  return new Response(
    frames
      .map(
        (frame) => `event: ${frame.type}\ndata: ${JSON.stringify(frame)}\n\n`,
      )
      .join(""),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}
