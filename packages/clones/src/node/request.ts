import { z } from "zod";

export const cloneIdPattern = /^[a-z0-9]{8}$/;

export const maximumTaskLength = 32_000;

const repositoryPattern = /^[\w.-]+\/[\w.-]+$/;
const identifier = z.number().int().positive();

const targetSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("new") }),
  z.strictObject({ kind: z.literal("issue"), number: identifier }),
  z.strictObject({ kind: z.literal("pull"), number: identifier }),
]);

export type CloneTarget = z.infer<typeof targetSchema>;

const shared = {
  version: z.literal(1),
  id: z.string().regex(cloneIdPattern),
  repository: z.string().regex(repositoryPattern),
  createdAt: z.string(),
};

export const cloneRequestSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    ...shared,
    kind: z.literal("work"),
    task: z.string().max(maximumTaskLength),
    target: targetSchema,
  }),
  z.strictObject({ ...shared, kind: z.literal("review"), pull: identifier }),
]);

export type CloneRequest = z.infer<typeof cloneRequestSchema>;

export function newCloneId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";

  return Array.from(
    crypto.getRandomValues(new Uint8Array(8)),
    (byte) => alphabet[byte % alphabet.length],
  ).join("");
}

export function busyTarget(request: CloneRequest): string | null {
  if (request.kind === "review") {
    return `pull:${request.pull}`;
  }

  return request.target.kind === "new" ? null : `${request.target.kind}:${request.target.number}`;
}

export function requestSummary(request: CloneRequest): string {
  if (request.kind === "review") {
    return `Review pull request #${request.pull}`;
  }

  const [firstLine = ""] = request.task.trim().split("\n");
  const where =
    request.target.kind === "issue"
      ? ` (issue #${request.target.number})`
      : request.target.kind === "pull"
        ? ` (pull request #${request.target.number})`
        : "";
  const text = firstLine.length > 120 ? `${firstLine.slice(0, 117)}...` : firstLine;

  return `${text === "" ? "Do the described work" : text}${where}`;
}
