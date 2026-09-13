# Landscape

What already exists, checked in September 2026, and the gap shadowclone occupies.

## What exists

**Native auto memory.** Claude Code ships native auto memory, free and enabled by default. It writes project-scoped notes to `~/.claude/projects/<project>/memory/` across four categories: `user` for role and preferences, `feedback` for corrections and confirmed patterns, `project` for architecture guidelines, and `reference` for external pointers. It updates on session close and supports subagents. It begins accumulating on install and learns forward.

**Transcript viewers.** `claude-code-log`, `simonw/claude-code-transcripts`, `claude-notes`, LM Assist, and `claude-dev.tools` all read `~/.claude/projects/*.jsonl`. Every one of them renders or publishes. None derives anything from what it reads. They prove the corpus is readable and that people want to look at it, and they stop there.

**Memory layers.** `mem0`, `claude-mem`, Letta, Zep, Lians, and Kage give an agent persistent memory across sessions. `mem0` runs an LLM extraction pass on write into a vector store and ships a Claude Code plugin. Lians is a local-first bitemporal fact store with erasure proofs, aimed at audited institutions. Kage stores codebase decisions as plain files in the repo and verifies each against the code before serving it. All of them store what was said or decided. None mines what the user did.

**Self-improving agents.** Hermes Agent by Nous Research, 241.7k stars at time of writing, is the reference point. It writes skills from its own completed tasks, keeps episodic memory in SQLite FTS5, and maintains `USER.md` as a model of the user. It learns only from its own sessions, requires its own keys or a Nous Portal subscription, and has no concept of an organization boundary. It is a harness, and a good one. It is not a reader of other harnesses.

**Correction compilers.** TRACE, published as arXiv 2606.13174 with `tellonce` as the deployable skill, is the closest prior work. It mines user corrections from live sessions via hooks, rewrites each as an atomic rule with an executable check, and enforces the check before an agent may finish a task. Runs on Claude Code, Codex, and Copilot CLI, stores rules in SQLite per project, MIT licensed, 7 stars. Reported results: held-out preference violations fall from 100 percent to 37.6 percent in distribution and to 2 percent out of distribution, and in daily use the author's rule library reached about 280 rules in two months after which new rule creation fell 97 percent. It observes only from install forward and produces rules for the agent, not a copy of the user.

**Digital twins.** WeClone fine-tunes a model on chat logs to reproduce a person's conversational style. `clonellm` and similar wrap a persona around a model. These target voice, not engineering judgment, and none reads an agent transcript.

**Research.** A study of 20,574 coding agent sessions across 1,639 repositories operationalizes misalignment as a breakdown made visible through developer pushback and finds that 91.49 percent of visible resolutions required explicit user correction. That is the density of the signal shadowclone mines, measured independently.

## The product gap

Shadowclone combines eight capabilities that the reviewed tools separate.

First-party instruction tools, including Claude Code's `/doctor`, optimize one vendor's files from their text. They do not see the user's repeated corrections across sessions or maintain another vendor's setup. Anthropic's suggested rule to "match the surrounding code's comment density" would erase a deliberate zero-comments preference. Shadowclone carries that taste into ordinary agents and delegated clones, then learns from the transcripts those clones produce.

**Historical cold start.** Native auto memory starts empty on day one, and `tellonce` learns from sessions after installation. The measured development corpus already holds 994 interruptions and 445 denials in `~/.claude/projects/`, and Shadowclone can start from that existing history on the first run.

**Cross-vendor learning.** Lians and `tellonce` inject into several tools but learn per tool. Shadowclone builds one local profile from enabled Claude Code, Codex, Cursor, and Antigravity sources.

**Remote-owner scoping.** Native memory scopes by project directory path on disk. Shadowclone scopes rules to normalized `host/owner` identities and compiles one matching owner at a time. This is a coarse remote boundary, not proof of an employer or legal organization boundary.

**Main-agent delivery.** Native memory and instruction files are tied to one provider. Shadowclone gives the ordinary Claude Code, Codex, Cursor, and Antigravity session a stable native pointer and injects the current scoped profile at session start. A user does not need to select a custom subagent to receive their guidance.

**Portable personal skills.** Shadowclone installs complete starter skills into one canonical personal library and synchronizes provider-specific copies while preserving edits and conflicts. Skill maintenance can apply supported preference additions without replacing technical workflows.

**Tested transfer.** A fresh current-HEAD evaluation runs matched baseline and profile arms, independently verifies the repository, uses three binary judge votes, and reports task success, preference adherence, lift, paired outcomes, and regressions.

**Optional delegated work.** Shadowclone can compile the same profile into a Claude subagent or run a headless clone with provider-enforced tool permissions and a receipt. Delegation is an additional execution mode, not the only way the profile reaches an agent.

**The user's existing subscriptions.** Hermes needs Nous Portal or keys. `mem0` runs a paid extraction model. Native auto memory is tied to one vendor. Shadowclone shells out to authenticated CLIs already on the machine and holds no API keys.

## What to borrow

TRACE reports roughly 2 percent violations with enforced checks and 37 percent with instructions. Shadowclone cannot apply that result to bare tool-family denials. Until observation stores a privacy-safe action fingerprint that a live hook can reproduce, `boundaries.md` stays advisory in the system prompt.

The 20,574 session study's taxonomy, seven forms of misalignment covering how agents read projects, interpret intent, follow rules, bound actions, implement, and report progress, is a better category scheme for the mirror's output than anything invented here. The extractors should label into it.

## Positioning

Shadowclone turns how a developer works into a portable, tested environment for the coding agents they already use. It learns from enabled transcripts across vendors, scopes guidance by remote owner and repository, keeps personal skills synchronized, delivers the current profile to the main agent, and tests the resulting behavior through the developer's existing subscriptions.

The honest caveat is that the correction-mining category has 7 stars and one paper in it. That is an open field and an unproven market at the same time, and the 241.7k stars on Hermes are the evidence that the appetite for an agent that grows with its user is real.
