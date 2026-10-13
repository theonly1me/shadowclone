import { z } from "zod";
import { githubData, type GithubCall } from "../github";
import type { SessionConfig } from "../session/config";
import { readSessionHead } from "../state/sessionRef";
import { sessionRunning } from "../state/statusComment";
import { entityBranch, issuePaused, readEntity } from "./entity";
import {
  ignored,
  parseSessionCommand,
  type CommentSource,
  type Resolution,
  type SessionCommand,
} from "./event";

const commentSchema = z.object({
  id: z.number().int().positive(),
  body: z.string().nullable(),
  user: z.object({ id: z.number().int(), login: z.string(), type: z.string() }),
  updated_at: z.string().optional(),
  submitted_at: z.string().optional(),
  issue_url: z.string().optional(),
  pull_request_url: z.string().optional(),
});

function commentRoute(options: {
  readonly source: CommentSource;
  readonly id: number;
  readonly entity: number;
}): string {
  return options.source === "issue_comment"
    ? `issues/comments/${options.id}`
    : options.source === "pull_request_review_comment"
      ? `pulls/comments/${options.id}`
      : `pulls/${options.entity}/reviews/${options.id}`;
}

function commentEntity(options: {
  readonly config: SessionConfig;
  readonly source: CommentSource;
  readonly comment: z.infer<typeof commentSchema>;
  readonly entity: number;
}): number | null {
  const url =
    options.source === "issue_comment"
      ? options.comment.issue_url
      : options.comment.pull_request_url;
  const prefix = `https://api.github.com/repos/${options.config.repository}/${options.source === "issue_comment" ? "issues" : "pulls"}/`;

  if (url === undefined || !url.startsWith(prefix)) {
    return null;
  }

  const number = Number(url.slice(prefix.length));

  return Number.isSafeInteger(number) && number === options.entity ? number : null;
}

type Requester =
  { readonly kind: "owner"; readonly command: SessionCommand } | { readonly kind: "reviewer-bot" };

function requester(options: {
  readonly config: SessionConfig;
  readonly comment: z.infer<typeof commentSchema>;
}): Requester | null {
  const { config, comment } = options;

  if (comment.user.id === config.ownerId && comment.user.type === "User") {
    const command = parseSessionCommand(comment.body ?? "");

    return command === null ? null : { kind: "owner", command };
  }

  return comment.user.type === "Bot" && config.reviewerBots.includes(comment.user.login)
    ? { kind: "reviewer-bot" }
    : null;
}

export async function resolveComment(options: {
  readonly github: GithubCall;
  readonly config: SessionConfig;
  readonly source: CommentSource;
  readonly id: number;
  readonly entity: number;
  readonly now: Date;
}): Promise<Resolution> {
  const { github, config, source } = options;
  const comment = commentSchema.parse(
    await githubData({ github, route: `repos/${config.repository}/${commentRoute(options)}` }),
  );
  const entityNumber = commentEntity({ config, source, comment, entity: options.entity });
  const who = requester({ config, comment });

  if (entityNumber === null) {
    return ignored("The comment does not belong to this repository.");
  }

  if (who === null) {
    return ignored(
      "Only the owner's /shadowclone command or an allowed reviewer bot starts a session.",
    );
  }

  const entity = await readEntity({ github, config, entity: entityNumber });
  const branch = entityBranch(entity);
  const kind = who.kind === "reviewer-bot" ? "continue" : who.command.kind;

  if (!entity.open || branch === null) {
    return ignored("The issue or pull request is closed, or its branch name is not safe.");
  }

  if (entity.paused || (await issuePaused({ github, config, branch }))) {
    return ignored("The work is paused.");
  }

  if (kind === "review" && entity.pull === null) {
    return ignored("A review needs a pull request.");
  }

  if (kind !== "review" && entity.pull?.fork === true) {
    return ignored("A session cannot push to a fork.");
  }

  if (
    kind !== "continue" &&
    (await sessionRunning({ github, config, entity: entityNumber, now: options.now }))
  ) {
    return ignored("A session is already working on this issue or pull request.");
  }

  if (
    kind === "continue" &&
    (!entity.session || (await readSessionHead({ github, config, branch })) === null)
  ) {
    return ignored("A reviewer bot continues only a session pull request.");
  }

  return {
    kind: "accepted",
    request: {
      kind,
      source,
      identifier: comment.id,
      entity: entityNumber,
      pull: entity.pull !== null,
      branch,
      head: entity.pull?.head ?? "",
      ownerAuthored: entity.pull?.ownerAuthored ?? true,
      fork: entity.pull?.fork ?? false,
      key: `${source}:${comment.id}:${comment.updated_at ?? comment.submitted_at ?? ""}`,
      task: who.kind === "owner" && who.command.kind === "work" ? who.command.task : "",
    },
  };
}
