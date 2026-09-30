# Simpler, agent-led setup and bounded first learning

## Problem

Initial setup asked too many detailed questions before producing useful guidance. Spawned Claude subagents could miss live context, and setup or evaluation work could outlast a reasonable first run.

Installing the plugin also required users to install and configure the CLI themselves. A plugin could activate bundled skills before the user chose them, and non-interactive setup could not express the three consent decisions safely.

## Decision

Use a short default setup covering source access, skill maintenance, and background learning, with detailed source selection available in advanced mode. After consent, allow a first learning pass capped at 12 calls and 90 seconds, with a $1 ceiling where supported.

Deliver scoped context to spawned Claude agents through `SubagentStart` as well as the main-session path. Preserve existing hook configuration and keep session attribution separate from the supplied guidance.

Publish a dedicated plugin whose only active skill is `setup-shadowclone`. The skill detects whether the CLI and configuration exist, installs the public CLI without elevated privileges when needed, and asks separately about session learning, skill maintenance, and background learning. It passes all three decisions as explicit flags, installs the detected supported agents, starts the loopback wizard without opening a browser, and gives the local URL to the user. After the user applies a build, it runs synchronization, diagnostics, and context checks before asking them to restart their agent.

Keep the distributable plugin below `plugins/shadowclone` so the repository's seed skill library cannot activate during plugin installation. Publish portable, Claude, and Codex manifests plus MCP configuration from that directory, and point both marketplaces to it. Keep manifest versions synchronized with the CLI release.

Support `shadowclone init --status --json` for read-only detection and explicit `--learn`, `--skill-maintenance`, and `--background-learning` consent flags with matching negative forms. Any explicit consent flag requires all three decisions. In a non-interactive process, incomplete consent exits without writing configuration. Background learning requires session learning. Existing configuration is preserved.

Serialize reconciliation where concurrent writers could lose changes. Evaluate from frozen snapshots so later learning or user edits cannot change a comparison mid-run. Bound task generation, candidate execution, and judging, and preserve recoverable results when a limit is reached.

## Verification

Exercise the default and advanced setup paths, cancellation, first-pass limits, concurrent updates, and main-agent and subagent delivery. Synthetic and live checks establish only the behavior they exercise. Successful setup or a completed evaluation does not establish a productivity gain.

Package and validate the nested plugin for Claude, Codex, Cursor, Antigravity, and agents that can follow a portable setup skill. Test status output, complete and incomplete consent flags, invalid consent combinations, non-interactive behavior, and preservation of existing configuration. Run the security scanner with a minimum score of 90 and fail on medium or higher findings.

The browser-first skill editor is described in [agent builds](024-agent-builds.md).
