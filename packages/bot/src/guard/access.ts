import type { Clone, GithubRequest } from "../types";
import { readGithub } from "./records";

const writingPermissions = ["admin", "maintain", "write"];

export async function hasWriteAccess(options: {
  readonly clone: Clone;
  readonly request: GithubRequest;
  readonly actor: string;
}): Promise<boolean> {
  if (options.actor === options.clone.botLogin || options.actor.endsWith("[bot]")) {
    return false;
  }

  const permission = await readGithub({
    request: options.request,
    route: `GET /repos/${options.clone.repository}/collaborators/${options.actor}/permission`,
  });

  return writingPermissions.includes(String(permission.permission));
}

export function mentionsBot(options: { readonly clone: Clone; readonly text: string }): boolean {
  return new RegExp(`(^|\\s)@${options.clone.botLogin}(?=$|[\\s,:.])`, "i").test(options.text);
}
