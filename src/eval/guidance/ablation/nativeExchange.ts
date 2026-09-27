import path from "node:path";

type Block =
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, string>;
    }
  | { type: "text"; text: string };

export function nativeExchange(options: {
  directory: string;
  request: number;
  stream: boolean;
  scripted: boolean;
}): Response {
  const memory = path.join(options.directory, "memory/MEMORY.md");
  const reference = path.join(options.directory, "references/fixture.md");
  const finished = !options.scripted || options.request >= 5;

  const content: Block[] = finished
    ? [{ type: "text", text: "Synthetic native contract complete." }]
    : options.request === 1
      ? [
          {
            type: "tool_use",
            id: "read_reference",
            name: "Read",
            input: { file_path: reference },
          },
          {
            type: "tool_use",
            id: "read_memory",
            name: "Read",
            input: { file_path: memory },
          },
        ]
      : options.request === 2
        ? [
            {
              type: "tool_use",
              id: "write_memory",
              name: "Write",
              input: {
                file_path: memory,
                content: "Synthetic overwrite must be denied.\n",
              },
            },
          ]
        : options.request === 3
          ? [
              {
                type: "tool_use",
                id: "edit_memory",
                name: "Edit",
                input: {
                  file_path: memory,
                  old_string: "SHADOWCLONE_SYNTHETIC_PACKET_BEGIN",
                  new_string: "Synthetic edit must be denied.",
                },
              },
            ]
          : [
              {
                type: "tool_use",
                id: "create_memory",
                name: "Bash",
                input: {
                  command: `/usr/bin/touch ${JSON.stringify(path.join(options.directory, "memory/new.md"))}`,
                },
              },
            ];

  const message = {
    id: `msg_native_${options.request}`,
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5",
    content,
    stop_reason: finished ? "end_turn" : "tool_use",
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
