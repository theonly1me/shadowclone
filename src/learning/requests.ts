import path from "node:path";
import { z } from "zod";
import { fingerprint, readLocalText, replaceLocalText } from "../localFiles";
import type { ProjectPaths } from "../paths";

const requestSchema = z.strictObject({
  token: z.uuid(),
  integrationId: z.uuid(),
  sessionKey: z.string().min(1),
  createdAt: z.number(),
  requestedAt: z.number().nullable(),
  endedAt: z.number().nullable(),
  scheduledAt: z.number().nullable(),
});
const requestsSchema = z.strictObject({
  version: z.literal(1),
  requests: z.array(requestSchema),
});
type LearningRequest = z.infer<typeof requestSchema>;
const requestLifetime = 30 * 24 * 60 * 60 * 1_000;

function requestPath(paths: ProjectPaths): string {
  return path.join(paths.shadowcloneDirectory, "session-learning.json");
}

async function readRequests(paths: ProjectPaths): Promise<readonly LearningRequest[]> {
  const text = await readLocalText(requestPath(paths));
  if (text === null) {
    return [];
  }
  try {
    return requestsSchema.parse(JSON.parse(text)).requests;
  } catch {
    throw new Error("Invalid session learning state");
  }
}

async function writeRequests(options: {
  readonly paths: ProjectPaths;
  readonly requests: readonly LearningRequest[];
}): Promise<void> {
  const filePath = requestPath(options.paths);
  await replaceLocalText({
    filePath,
    previous: await readLocalText(filePath),
    next: `${JSON.stringify({ version: 1, requests: options.requests }, null, 2)}\n`,
  });
}

function currentRequests(options: {
  readonly requests: readonly LearningRequest[];
  readonly now: number;
}): readonly LearningRequest[] {
  return options.requests.filter(
    (request) => request.createdAt >= options.now - requestLifetime,
  );
}

export function learningSessionKey(options: {
  readonly agent: string;
  readonly nativeSessionId: string;
}): string {
  return fingerprint(`${options.agent}:${options.nativeSessionId}`);
}

export async function createLearningRequest(options: {
  readonly paths: ProjectPaths;
  readonly integrationId: string;
  readonly sessionKey: string;
  readonly now?: number;
}): Promise<string> {
  const now = options.now ?? Date.now();
  const requests = currentRequests({
    requests: await readRequests(options.paths),
    now,
  });
  const existing = requests.find((request) =>
    request.integrationId === options.integrationId &&
    request.sessionKey === options.sessionKey &&
    request.scheduledAt === null
  );
  if (existing) {
    return existing.token;
  }
  const created: LearningRequest = {
    token: crypto.randomUUID(),
    integrationId: options.integrationId,
    sessionKey: options.sessionKey,
    createdAt: now,
    requestedAt: null,
    endedAt: null,
    scheduledAt: null,
  };
  await writeRequests({ paths: options.paths, requests: [...requests, created] });
  return created.token;
}

export async function markLearningRequest(options: {
  readonly paths: ProjectPaths;
  readonly token: string;
  readonly now?: number;
}): Promise<boolean> {
  const now = options.now ?? Date.now();
  const requests = currentRequests({
    requests: await readRequests(options.paths),
    now,
  });
  let found = false;
  const updated = requests.map((request) => {
    if (request.token !== options.token) {
      return request;
    }
    found = true;
    return { ...request, requestedAt: now, scheduledAt: null };
  });
  if (!found) {
    throw new Error("Unknown or expired learning session token");
  }
  await writeRequests({ paths: options.paths, requests: updated });
  return updated.some((request) =>
    request.token === options.token && request.endedAt !== null
  );
}

export async function claimLearningRequests(options: {
  readonly paths: ProjectPaths;
  readonly integrationId?: string;
  readonly sessionKey?: string;
  readonly includeUnended?: boolean;
  readonly now?: number;
}): Promise<readonly string[]> {
  const now = options.now ?? Date.now();
  const requests = currentRequests({
    requests: await readRequests(options.paths),
    now,
  });
  const claimed = requests.filter((request) =>
    request.requestedAt !== null &&
    request.scheduledAt === null &&
    (options.includeUnended || request.endedAt !== null) &&
    (options.integrationId === undefined ||
      request.integrationId === options.integrationId) &&
    (options.sessionKey === undefined || request.sessionKey === options.sessionKey)
  );
  if (claimed.length === 0) {
    return [];
  }
  const tokens = new Set(claimed.map((request) => request.token));
  await writeRequests({
    paths: options.paths,
    requests: requests.map((request) =>
      tokens.has(request.token) ? { ...request, scheduledAt: now } : request
    ),
  });
  return [...new Set(claimed.map((request) => request.sessionKey))];
}

export async function endLearningRequest(options: {
  readonly paths: ProjectPaths;
  readonly integrationId: string;
  readonly sessionKey: string;
  readonly now?: number;
}): Promise<void> {
  const now = options.now ?? Date.now();
  const requests = currentRequests({
    requests: await readRequests(options.paths),
    now,
  });
  await writeRequests({
    paths: options.paths,
    requests: requests.map((request) =>
      request.integrationId === options.integrationId &&
      request.sessionKey === options.sessionKey
        ? { ...request, endedAt: now }
        : request
    ),
  });
}
