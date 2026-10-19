import { randomUUID } from "node:crypto";
import { fromNodeSchema, parseMessage, type NodeRequest } from "./protocol";

export type NodeSocket = { readonly send: (text: string) => void; readonly close: () => void };

type Pending = {
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: Error) => void;
};

type Link = { readonly socket: NodeSocket; readonly pending: Map<string, Pending> };

export type NodeLinks = {
  readonly connect: (options: { readonly name: string; readonly socket: NodeSocket }) => void;
  readonly disconnect: (options: { readonly name: string; readonly socket: NodeSocket }) => void;
  readonly receive: (options: { readonly name: string; readonly text: string }) => void;
  readonly connected: (name: string) => boolean;
  readonly request: (options: {
    readonly name: string;
    readonly message: NodeRequest;
  }) => Promise<unknown>;
};

function dropLink(link: Link, reason: string): void {
  for (const pending of link.pending.values()) {
    pending.reject(new Error(reason));
  }

  link.pending.clear();
}

export function nodeLinks(options: { readonly timeoutMilliseconds?: number } = {}): NodeLinks {
  const links = new Map<string, Link>();
  const timeout = options.timeoutMilliseconds ?? 15_000;

  return {
    connect: ({ name, socket }) => {
      const earlier = links.get(name);

      if (earlier !== undefined) {
        dropLink(earlier, `Node ${name} connected again.`);
        earlier.socket.close();
      }

      links.set(name, { socket, pending: new Map() });
    },
    disconnect: ({ name, socket }) => {
      const link = links.get(name);

      if (link?.socket === socket) {
        dropLink(link, `Node ${name} went offline.`);
        links.delete(name);
      }
    },
    receive: ({ name, text }) => {
      const message = fromNodeSchema.safeParse(parseMessage(text));
      const pending = message.success ? links.get(name)?.pending.get(message.data.id) : undefined;

      if (message.success && pending !== undefined) {
        links.get(name)?.pending.delete(message.data.id);
        pending.resolve(message.data.result);
      }
    },
    connected: (name) => links.has(name),
    request: ({ name, message }) => {
      const link = links.get(name);

      if (link === undefined) {
        return Promise.reject(new Error(`Node ${name} is offline.`));
      }

      const id = randomUUID();

      return new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => {
          link.pending.delete(id);
          reject(new Error(`Node ${name} did not answer within ${timeout / 1000} seconds.`));
        }, timeout);

        link.pending.set(id, {
          resolve: (value) => {
            clearTimeout(timer);
            resolve(value);
          },
          reject: (error) => {
            clearTimeout(timer);
            reject(error);
          },
        });
        link.socket.send(JSON.stringify({ ...message, id }));
      });
    },
  };
}
