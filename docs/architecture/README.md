# Architecture

shadowclone turns durable guidance from consented sessions into skills that coding agents use. Local records keep evidence, scope, publication decisions, and revisions. Native instructions route tasks to skills.

## Packages

The repository is a Bun workspace. Each package is `@shadowclone/<name>` and has an `AGENTS.md` with its rules.

| Package                                               | Purpose                                              |
| ----------------------------------------------------- | ---------------------------------------------------- |
| [`core`](../../packages/core/AGENTS.md)               | Files, processes, ownership, configuration, identity |
| [`redact`](../../packages/redact/AGENTS.md)           | Secret scrubbing                                     |
| [`agents`](../../packages/agents/AGENTS.md)           | Run agent CLIs without a terminal                    |
| [`sessions`](../../packages/sessions/AGENTS.md)       | Transcripts, event index, redacted text              |
| [`review`](../../packages/review/AGENTS.md)           | Pull request review engine                           |
| [`changes`](../../packages/changes/AGENTS.md)         | Reversible local writes, stored as revisions         |
| [`skills`](../../packages/skills/AGENTS.md)           | Skill files without model calls                      |
| [`profile`](../../packages/profile/AGENTS.md)         | Learned rule model and Claude memory scanner         |
| [`environment`](../../packages/environment/AGENTS.md) | Publication, native sections, install, and undo      |
| [`builds`](../../packages/builds/AGENTS.md)           | Agent builds                                         |
| [`learning`](../../packages/learning/AGENTS.md)       | Distillation, reconciliation, probes, `remember`     |
| [`harness`](../../packages/harness/AGENTS.md)         | Repository harness for `init --repo` and `check`     |
| [`bot`](../../packages/bot/AGENTS.md)                 | GitHub Actions bot setup and workflows               |
| [`clones`](../../packages/clones/AGENTS.md)           | Clones on a machine that the owner owns              |
| [`web`](../../packages/web/AGENTS.md)                 | Wizard, voice capture, and skill drafts              |
| [`mcp`](../../packages/mcp/AGENTS.md)                 | MCP server                                           |
| [`hub`](../../packages/hub/AGENTS.md)                 | Remote MCP server with OAuth for clones              |
| [`cli`](../../packages/cli/AGENTS.md)                 | Commands, build, and publish                         |
| [`evals`](../../evals/AGENTS.md)                      | Private evaluation suites                            |
| [`tooling`](../../tooling/AGENTS.md)                  | Repository checks that `bun run lint` runs           |

`skills/`, `preferences/`, and `plugins/` stay at the repository root, where installers look. `@shadowclone/cli` bundles private runtime packages for npm. A separate `@shadowclone/skills` artifact publishes root skill content.

## Dependencies

An arrow points from a package to a package that it imports. The graph omits an arrow that another path implies. For example, `cli` also declares `environment`, but `mcp` and `harness` already lead to it.

```mermaid
graph BT
  redact --> core
  agents --> redact
  sessions --> redact
  changes --> sessions
  skills --> changes
  profile --> sessions
  environment --> profile
  environment --> skills
  environment --> agents
  builds --> environment
  learning --> environment
  harness --> environment
  review --> agents
  bot --> environment
  web --> builds
  web --> learning
  mcp --> learning
  clones --> bot
  mcp --> clones
  hub --> mcp
  cli --> hub
  cli --> web
  cli --> harness
  cli --> review
```

`tooling/src/boundaries/packages.ts` lists the allowed imports. `bun run lint` checks every import against it and fails on a cycle. A package exposes `.` and, where needed, `./testing` for fixtures and `./browser` for web client modules. See [design record 038](../design/038-packages-and-plain-english.md).

## Data flow

Data stays on your machine except for the requests and GitHub actions that you authorize. [Data handling](../data-handling.md) lists every source, file, and request.

```mermaid
flowchart LR
  subgraph Machine["Your machine"]
    Sources["Consented sessions and memory"] --> Index["sessions: event index"]
    Index --> Redaction["resolveRedacted: redacted user text"]
    Redaction --> Learning["learning: reconcile guidance"]
    Instructions["Your instruction files and skills"] --> Learning
    Learning --> Review["Triage: apply, discard, or hold"]
    Review --> Revision["changes: one revision"]
    Revision --> Delivery["environment: skills and native sections"]
    Delivery --> Agents["Coding agents"]
    Agents --> Sources
    Diff["Pull request diff and base standards"] --> Judge["review: rules, checks, model"]
    Diff --> Sandbox["Toolchain sandbox: worktree and isolated state"]
    Runtime["Read-only tool runtimes"] --> Sandbox
    Sandbox -- "diagnostics" --> Judge
  end
  Learning -- "redacted excerpts, no tools" --> Provider["Model provider via your agent CLI"]
  Judge -- "diff and read-only file access" --> Provider
  Sandbox -- "restricted proxy" --> Registries["Allowed public package registries"]
  Delivery -- "reviewed skills" --> Bot["bot: GitHub Actions bot"]
  Delivery -- "reviewed skills" --> Session["clones: a clone in Docker on a machine that you own"]
  Start["Owner's task from the CLI or an MCP agent"] --> Session
  Phone["Claude app or another MCP client"] -- "OAuth through Tailscale Funnel" --> Hub["hub: MCP over HTTPS on loopback"]
  Hub --> Session
  Node["Another machine: hub link"] -- "WebSocket over the tailnet" --> Hub
  Session -- "prompt, skills, files that the agent reads" --> Provider
  subgraph GitHub["GitHub"]
    Bot --> Pulls["Draft pull requests and review comments"]
    Session -- "commits and pull requests as the owner" --> Pulls
  end
  Judge -- "redacted COMMENT review" --> Pulls
  Pulls --> Owner["Owner review and merge"]
```

## Trust boundaries

| Boundary                | What crosses it                           | Control                                                                                                                 |
| ----------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Source files to index   | Pointers and event metadata, no text      | A default-off consent flag for each source. Policy can only narrow it                                                   |
| Index to model          | Redacted user text, labeled agent context | `resolveRedacted`, then a run with no tools and fixed limits                                                            |
| Model output to files   | Proposed skill and native edits           | Reversible revisions, ownership fingerprints, kept manual edits                                                         |
| Browser to local server | Wizard actions                            | Loopback, ephemeral token, origin check                                                                                 |
| PR code to host         | Toolchain installs, scripts, and configs  | Bubblewrap or Seatbelt. Worktree and isolated state writes only. No host credentials or local sockets                   |
| Toolchain to network    | Dependency downloads                      | A fixed public-registry allowlist through a restricted proxy                                                            |
| Machine to GitHub       | Reviewed skills, secrets, review text     | Owner approval of an exact preview. Secrets use standard input                                                          |
| Owner task to clone     | A task that starts work as the owner      | A local CLI or MCP call on the owner's machine, a run folder with mode 0700, and a container with only the secrets file |
| Internet to hub         | Clone tool calls from approved clients    | OAuth with PKCE, a single-use pairing code, hashed tokens, revocation, the lock, and an optional source allowlist       |
| Evaluation              | Synthetic tasks, receipts, held-out cases | Private storage outside checkouts. Approved scope per paid run                                                          |

## How the packages work together

`sessions` indexes events and gives `learning` only the text that current consent allows. `learning` reconciles that text with existing guidance and calls the model through `agents`. It holds a proposal for review when evidence is weak, in conflict, or out of scope.

`environment` publishes accepted guidance as skills and short native sections through `changes`, so each publication is one revision that `undo` can reverse. `builds` and `harness` use the same path.

The code checks source authorization when it selects an event and again when it resolves the reference. A later correction creates a review signal. A probe sends redacted guidance to an isolated native session, and its exact-response check does not prove hook delivery or future compliance.

## Delegated work

Outside the Actions bot, shadowclone does not commit, push, or act on GitHub itself. Delegated work is the `shadowclone-work` skill. It acts through the tools and permissions of your agent session. See [delegated work](../guides/delegated-work.md).

The Actions bot is a separate contract. The owner reviews a frozen skills bundle and chooses the repositories. GitHub Actions run the same skill, and the owner merges. See the [Actions bot guide](../guides/actions-bot.md).

Clones are a third contract. The owner starts a clone from the CLI or an MCP agent on the machine that runs it. The clone runs the same skill in Docker on that machine and acts as the owner. See [clones](../guides/clones.md) and [design record 049](../design/049-clones.md).

Design records [029](../design/029-narrow-the-surface.md) and [030](../design/030-shadowclone-work-eval.md) explain the removed `run` command and task harness. A review comment, a merge, a deletion, or a successful agent result does not establish a preference.

More detail: [capture](01-capture.md), [learning and skill delivery](02-profile.md), and [engine](03-engine.md).
