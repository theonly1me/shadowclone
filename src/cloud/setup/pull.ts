import { z } from "zod";
import type { Clone } from "../types";
import { renderWorkflows } from "../workflow";
import type { GithubApi } from "./github";

const shaSchema = z.object({ sha: z.string().regex(/^[a-f0-9]{40}$/) });

export async function createSetupPull(options: {
  readonly clone: Clone;
  readonly token: string;
  readonly api: GithubApi;
}): Promise<string> {
  const { clone, token, api } = options;
  const base = `/repos/${clone.repository}`;
  const reference = z.object({ object: shaSchema }).parse(
    await api({
      route: `GET ${base}/git/ref/heads/${encodeURIComponent(clone.defaultBranch)}`,
      token,
    }),
  );
  const commit = z.object({ tree: shaSchema }).parse(
    await api({
      route: `GET ${base}/git/commits/${reference.object.sha}`,
      token,
    }),
  );
  const existing = z
    .object({
      truncated: z.boolean(),
      tree: z.array(z.object({ path: z.string() })),
    })
    .parse(
      await api({
        route: `GET ${base}/git/trees/${commit.tree.sha}?recursive=1`,
        token,
      }),
    );

  if (
    existing.truncated ||
    existing.tree.some(
      (entry) =>
        entry.path.startsWith(".github/shadowclone/") ||
        [".github/workflows/shadowclone.yml", ".github/workflows/shadowclone-relay.yml"].includes(
          entry.path,
        ),
    )
  ) {
    throw new Error(
      "A clone workflow already exists, or the tree is incomplete. Review it " +
        "before replacing the installation.",
    );
  }

  const files = renderWorkflows(clone);
  const tree = shaSchema.parse(
    await api({
      route: `POST ${base}/git/trees`,
      token,
      body: {
        base_tree: commit.tree.sha,
        tree: Object.entries(files).map(([filePath, content]) => ({
          path: filePath,
          content,
          type: "blob",
          mode: "100644",
        })),
      },
    }),
  );
  const created = shaSchema.parse(
    await api({
      route: `POST ${base}/git/commits`,
      token,
      body: {
        message: "ci: configure personal github clone",
        tree: tree.sha,
        parents: [reference.object.sha],
      },
    }),
  );
  const branch = `shadowclone/setup-${crypto.randomUUID()}`;

  await api({
    route: `POST ${base}/git/refs`,
    token,
    body: { ref: `refs/heads/${branch}`, sha: created.sha },
  });

  const body = `## What changed

- [x] Configure ${clone.botLogin} for this repository.
- [x] Validate requests before accessing the default-branch environment.

## Why

Owner issues and tagged requests need the reviewed personal engineering skills in cloud runs.

## Verification

1. Review both workflows and the guard helpers.
2. Merge this setup PR when the configuration is correct.
3. Create one small issue as ${clone.owner} and confirm the draft PR uses the App identity.
4. Add shadowclone:paused and confirm active work stops.

The live issue flow still needs qualification.
Each worker has a 20-minute limit and a daily branch limit of ${clone.maximumRuns} runs.

## Data handling

Credentials and the reviewed skills are environment secrets.
Only ${clone.defaultBranch} can access them. Each App token names this repository alone.
The default-branch workflow and code executed with credentials remain trusted.
`;
  const pull = z
    .object({
      html_url: z.url().startsWith(`https://github.com/${clone.repository}/pull/`),
    })
    .parse(
      await api({
        route: `POST ${base}/pulls`,
        token,
        body: {
          title: "ci: configure personal github clone",
          body,
          head: branch,
          base: clone.defaultBranch,
          draft: true,
        },
      }),
    );

  return pull.html_url;
}
