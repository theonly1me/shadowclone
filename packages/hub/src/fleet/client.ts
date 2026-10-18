import type { CloneNode } from "@shadowclone/clones";
import type { LiveSessions } from "@shadowclone/live";
import { holds } from "./holds";
import { createSessionsTools } from "@shadowclone/mcp";
import { nodeProtocols, parseMessage, textResult, toNodeSchema, type ToNode } from "./protocol";

export type NodeLink = { readonly hubUrl: string; readonly name: string; readonly token: string };

export async function answerHub(options: {
  readonly message: ToNode;
  readonly node: CloneNode;
  readonly live?: LiveSessions;
}): Promise<unknown> {
  const { message, node, live } = options;

  if (message.type === "has") {
    return holds({ node, live, id: message.clone });
  }

  return (
    (await createSessionsTools({ node, ...(live === undefined ? {} : { live }) }).run(
      message.params,
    )) ?? textResult({ value: "Unknown tool.", isError: true })
  );
}

function connectOnce(options: {
  readonly link: NodeLink;
  readonly node: CloneNode;
  readonly live?: LiveSessions;
  readonly signal: AbortSignal;
  readonly log: (line: string) => void;
}): Promise<boolean> {
  const { link, node, log } = options;
  const url = `${link.hubUrl.replace(/^http/, "ws")}/nodes/link`;
  const socket = new WebSocket(url, [...nodeProtocols(link.token)]);
  let opened = false;

  return new Promise<boolean>((resolve) => {
    const stop = () => socket.close();

    options.signal.addEventListener("abort", stop, { once: true });
    socket.addEventListener("open", () => {
      opened = true;
      log(`Node ${link.name} is connected to ${link.hubUrl}.`);
    });
    socket.addEventListener("message", (event) => {
      const message = toNodeSchema.safeParse(parseMessage(String(event.data)));

      if (message.success) {
        answerHub({
          message: message.data,
          node,
          ...(options.live === undefined ? {} : { live: options.live }),
        })
          .then((result) =>
            socket.send(JSON.stringify({ type: "result", id: message.data.id, result })),
          )
          .catch((error: unknown) =>
            socket.send(
              JSON.stringify({
                type: "result",
                id: message.data.id,
                result: textResult({
                  value: error instanceof Error ? error.message : String(error),
                  isError: true,
                }),
              }),
            ),
          );
      }
    });
    socket.addEventListener("close", (event) => {
      options.signal.removeEventListener("abort", stop);

      if (opened) {
        log(`Node ${link.name} lost the hub connection (${event.code}).`);
      }

      resolve(opened);
    });
  });
}

export async function runNodeLink(options: {
  readonly link: NodeLink;
  readonly node: CloneNode;
  readonly live?: LiveSessions;
  readonly signal: AbortSignal;
  readonly log: (line: string) => void;
  readonly wait?: (milliseconds: number) => Promise<void>;
}): Promise<void> {
  const wait = options.wait ?? ((milliseconds: number) => Bun.sleep(milliseconds));
  let delay = 1000;

  while (!options.signal.aborted) {
    const opened = await connectOnce(options);

    delay = opened ? 1000 : Math.min(delay * 2, 60_000);

    if (!options.signal.aborted) {
      await wait(delay);
    }
  }
}
