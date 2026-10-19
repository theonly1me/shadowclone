import { z } from "zod";
import type { EngineProcess } from "../processes";
import { closeEngine, engineExitedEnd, turnQueue, type EngineDriver } from "./turns";

const resultSchema = z.object({
  type: z.literal("result"),
  subtype: z.string(),
  is_error: z.boolean().optional(),
  result: z.string().optional(),
});

function userMessage(text: string): string {
  return JSON.stringify({
    type: "user",
    message: { role: "user", content: [{ type: "text", text }] },
  });
}

function parseResult(line: string): z.infer<typeof resultSchema> | null {
  try {
    const parsed = resultSchema.safeParse(JSON.parse(line));

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function claudeDriver(options: {
  readonly engine: EngineProcess;
  readonly prompt: string;
  readonly graceMilliseconds?: number;
}): EngineDriver {
  const { engine } = options;
  const turns = turnQueue();
  const held: string[] = [];
  let active = true;
  let interrupting = false;
  let requests = 0;

  engine.write(userMessage(options.prompt));

  const reading = (async () => {
    for await (const line of engine.lines) {
      const result = parseResult(line);

      if (result === null) {
        continue;
      }

      if (interrupting) {
        interrupting = false;

        for (const text of held.splice(0)) {
          engine.write(userMessage(text));
        }

        continue;
      }

      active = false;
      turns.push({
        outcome: result.subtype === "success" && result.is_error !== true ? "completed" : "failed",
        summary: result.result ?? "",
      });
    }

    if (active) {
      active = false;
      turns.push(engineExitedEnd);
    }
  })();

  return {
    send: async (text) => {
      if (!active) {
        active = true;
        engine.write(userMessage(text));
        return;
      }

      held.push(text);

      if (!interrupting) {
        interrupting = true;
        requests++;
        engine.write(
          JSON.stringify({
            type: "control_request",
            request_id: `shadowclone-interrupt-${requests}`,
            request: { subtype: "interrupt" },
          }),
        );
      }
    },
    nextTurnEnd: turns.next,
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
