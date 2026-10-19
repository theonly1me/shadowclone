import { z } from "zod";
import { appendAskedQuestion, newQuestionId } from "./questions";

export const askToolName = "shadowclone_ask";

const askTool = {
  name: askToolName,
  description:
    "Ask the owner a question that needs their decision. Give your recommended option. The tool " +
    "returns at once. Keep working on the parts that do not depend on the answer. The answer " +
    "arrives later as a message from the owner.",
  inputSchema: {
    type: "object",
    properties: {
      question: { type: "string", description: "the decision that the owner must make" },
      options: { type: "array", items: { type: "string" }, description: "up to 6 choices" },
      recommended: { type: "string", description: "the option that you recommend, and why" },
    },
    required: ["question", "recommended"],
    additionalProperties: false,
  },
};

const askInputSchema = z.strictObject({
  question: z.string().min(1).max(2000),
  options: z.array(z.string().min(1).max(200)).max(6).default([]),
  recommended: z.string().min(1).max(200),
});

const requestSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  method: z.string(),
  params: z.object({ name: z.string().optional(), arguments: z.unknown().optional() }).optional(),
});

export const askedText =
  "The owner gets the question now. Continue with your recommended option where it is safe. Do not take a destructive or outward step that the question covers until the answer arrives.";

function text(options: { readonly value: string; readonly isError: boolean }) {
  return { content: [{ type: "text", text: options.value }], isError: options.isError };
}

export async function askResponse(options: {
  readonly line: string;
  readonly file: string;
}): Promise<Readonly<Record<string, unknown>> | null> {
  const parsed = requestSchema.safeParse(JSON.parse(options.line));

  if (!parsed.success || parsed.data.id === undefined) {
    return null;
  }

  const { id, method, params } = parsed.data;
  const reply = (result: unknown) => ({ jsonrpc: "2.0", id, result });

  if (method === "initialize") {
    return reply({
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "shadowclone-ask", version: "1" },
    });
  }

  if (method === "tools/list") {
    return reply({ tools: [askTool] });
  }

  if (method !== "tools/call" || params?.name !== askToolName) {
    return { jsonrpc: "2.0", id, error: { code: -32601, message: "Unknown method or tool" } };
  }

  const input = askInputSchema.safeParse(params.arguments);

  if (!input.success) {
    return reply(text({ value: "Give a question and your recommended option.", isError: true }));
  }

  await appendAskedQuestion({
    file: options.file,
    question: {
      id: newQuestionId(),
      text: input.data.question,
      options: input.data.options,
      recommended: input.data.recommended,
    },
  });

  return reply(text({ value: askedText, isError: false }));
}

export async function serveAskTool(options: {
  readonly file: string;
  readonly input: AsyncIterable<Uint8Array>;
  readonly write: (line: string) => Promise<unknown>;
}): Promise<void> {
  const decoder = new TextDecoder();
  let pending = "";

  for await (const chunk of options.input) {
    pending += decoder.decode(chunk, { stream: true });

    const lines = pending.split("\n");

    pending = lines.pop() ?? "";

    for (const line of lines.filter((entry) => entry.trim() !== "")) {
      const response = await askResponse({ line, file: options.file }).catch(() => ({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      }));

      if (response !== null) {
        await options.write(`${JSON.stringify(response)}\n`);
      }
    }
  }
}
