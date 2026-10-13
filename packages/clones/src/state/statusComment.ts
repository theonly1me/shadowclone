import { z } from "zod";
import { githubData, type GithubCall } from "../github";
import type { SessionConfig } from "../session/config";

export const sessionStates = ["working", "done", "saved", "failed", "limited"] as const;

export const sessionStatusSchema = z.strictObject({
  state: z.enum(sessionStates),
  key: z.string(),
  kind: z.enum(["work", "review", "continue"]),
  branch: z.string(),
  engine: z.enum(["claude", "codex"]),
  pull: z.number().int().positive().nullable(),
  startedAt: z.string(),
  updatedAt: z.string(),
  detail: z.string(),
});

export type SessionStatus = z.infer<typeof sessionStatusSchema>;

const marker = "<!-- shadowclone-session ";
const statePattern = /<!-- shadowclone-session (\{.*\}) -->/;

const headlines: Readonly<Record<SessionStatus["state"], string>> = {
  working: "is working on this",
  done: "finished",
  saved: "stopped and saved the unfinished work",
  failed: "failed",
  limited: "reached a usage limit and saved the unfinished work",
};

const engineNames: Readonly<Record<SessionStatus["engine"], string>> = {
  claude: "Claude Code",
  codex: "Codex",
};

export function renderStatus(status: SessionStatus): string {
  const lines = [
    `**shadowclone session ${headlines[status.state]}.**`,
    "",
    `Branch \`${status.branch}\` | ${engineNames[status.engine]} | started ${status.startedAt} | updated ${status.updatedAt}`,
    ...(status.pull === null ? [] : [`Pull request #${status.pull}`]),
    ...(status.detail === "" ? [] : ["", status.detail]),
    "",
    `${marker}${JSON.stringify(status).replaceAll(">", "\\u003e")} -->`,
  ];

  return lines.join("\n");
}

export function parseStatus(body: string): SessionStatus | null {
  const json = statePattern.exec(body)?.[1];

  if (json === undefined) {
    return null;
  }

  const parsed = sessionStatusSchema.safeParse(JSON.parse(json));

  return parsed.success ? parsed.data : null;
}

const commentSchema = z.object({
  id: z.number().int().positive(),
  body: z.string().nullable(),
  user: z.object({ id: z.number().int() }).nullable(),
});

export async function findStatusComment(options: {
  readonly github: GithubCall;
  readonly config: SessionConfig;
  readonly entity: number;
}): Promise<{ readonly id: number; readonly status: SessionStatus | null } | null> {
  for (let page = 1; page <= 10; page++) {
    const comments = z.array(commentSchema).parse(
      await githubData({
        github: options.github,
        route: `repos/${options.config.repository}/issues/${options.entity}/comments?per_page=100&page=${page}`,
      }),
    );
    const found = comments.find(
      (comment) =>
        comment.user?.id === options.config.ownerId && (comment.body ?? "").includes(marker),
    );

    if (found) {
      return { id: found.id, status: parseStatus(found.body ?? "") };
    }

    if (comments.length < 100) {
      return null;
    }
  }

  return null;
}

export async function writeStatus(options: {
  readonly github: GithubCall;
  readonly config: SessionConfig;
  readonly entity: number;
  readonly status: SessionStatus;
}): Promise<void> {
  const existing = await findStatusComment(options);
  const body = { body: renderStatus(options.status) };
  const base = `repos/${options.config.repository}/issues`;

  await githubData(
    existing === null
      ? {
          github: options.github,
          method: "POST",
          route: `${base}/${options.entity}/comments`,
          body,
        }
      : { github: options.github, method: "PATCH", route: `${base}/comments/${existing.id}`, body },
  );
}
