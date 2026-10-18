import { z } from "zod";
import type { EngineProcess } from "../processes";
import { closeEngine, engineExitedEnd, turnQueue, type EngineDriver } from "./turns";

export type CodexThread = {
  readonly cwd: string;
  readonly model?: string;
};

const messageSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  method: z.string().optional(),
  params: z.unknown().optional(),
  result: z.unknown().optional(),
  error: z.object({ message: z.string() }).optional(),
});

const turnIdSchema = z.object({ turn: z.object({ id: z.string() }) });
const threadIdSchema = z.object({ thread: z.object({ id: z.string() }) });
const completedSchema = z.object({ turn: z.object({ status: z.string() }) });
const agentMessageSchema = z.object({
  item: z.object({ type: z.literal("agentMessage"), text: z.string() }),
});

type Reply = z.infer<typeof messageSchema>;

function textInput(text: string) {
  return [{ type: "text", text, text_elements: [] }];
}

export function codexDriver(options: {
  readonly engine: EngineProcess;
  readonly prompt: string;
  readonly thread: CodexThread;
  readonly graceMilliseconds?: number;
}): EngineDriver {
  const { engine } = options;
  const turns = turnQueue();
  const replies = new Map<number, (reply: Reply) => void>();
  let nextId = 1;
  let threadId = "";
  let turnId = "";
  let active = true;
  let lastMessage = "";

  const request = (method: string, params: unknown) =>
    new Promise<Reply>((resolve) => {
      const id = nextId++;

      replies.set(id, resolve);
      engine.write(JSON.stringify({ id, method, params }));
    });

  const startTurn = async (text: string) => {
    active = true;

    const reply = await request("turn/start", { threadId, input: textInput(text) });
    const started = turnIdSchema.safeParse(reply.result);

    if (started.success) {
      turnId = started.data.turn.id;
    }
  };

  const handle = (message: Reply) => {
    if (message.method === undefined) {
      if (typeof message.id === "number") {
        replies.get(message.id)?.(message);
        replies.delete(message.id);
      }

      return;
    }

    if (message.id !== undefined) {
      engine.write(
        JSON.stringify({ id: message.id, error: { code: -32601, message: "Not supported" } }),
      );
      return;
    }

    const started = turnIdSchema.safeParse(message.params);
    const agent = agentMessageSchema.safeParse(message.params);
    const completed = completedSchema.safeParse(message.params);

    if (message.method === "turn/started" && started.success) {
      turnId = started.data.turn.id;
    } else if (message.method === "item/completed" && agent.success) {
      lastMessage = agent.data.item.text;
    } else if (message.method === "turn/completed" && completed.success) {
      active = false;
      turns.push({
        outcome: completed.data.turn.status === "completed" ? "completed" : "failed",
        summary: lastMessage,
      });
    }
  };

  const reading = (async () => {
    for await (const line of engine.lines) {
      try {
        const parsed = messageSchema.safeParse(JSON.parse(line));

        if (parsed.success) {
          handle(parsed.data);
        }
      } catch {
        continue;
      }
    }

    if (active) {
      active = false;
      turns.push(engineExitedEnd);
    }
  })();

  const ready = (async () => {
    await request("initialize", { clientInfo: { name: "shadowclone", version: "1" } });
    engine.write(JSON.stringify({ method: "initialized" }));

    const thread = await request("thread/start", {
      cwd: options.thread.cwd,
      approvalPolicy: "never",
      sandbox: "danger-full-access",
      ...(options.thread.model === undefined ? {} : { model: options.thread.model }),
    });
    const started = threadIdSchema.safeParse(thread.result);

    if (!started.success) {
      throw new Error(`Codex did not start a thread: ${thread.error?.message ?? "no thread id"}`);
    }

    threadId = started.data.thread.id;
    await startTurn(options.prompt);
  })();

  return {
    send: async (text) => {
      await ready;

      if (!active) {
        await startTurn(text);
        return;
      }

      const steer = await request("turn/steer", {
        threadId,
        expectedTurnId: turnId,
        input: textInput(text),
      });

      if (steer.error !== undefined) {
        await startTurn(text);
      }
    },
    nextTurnEnd: () =>
      Promise.race([
        turns.next(),
        ready.then(
          () => new Promise<never>(() => undefined),
          (error: unknown) => ({
            outcome: "failed" as const,
            summary: error instanceof Error ? error.message : String(error),
          }),
        ),
      ]),
    busy: () => active,
    close: async () => {
      const exitCode = await closeEngine({
        end: engine.end,
        terminate: engine.terminate,
        exited: engine.exited,
        graceMilliseconds: options.graceMilliseconds ?? 10_000,
      });

      await reading;

      return exitCode;
    },
  };
}
