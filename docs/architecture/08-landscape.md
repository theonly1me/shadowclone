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

## The gap

Five things none of the above does, evaluated against the current ecosystem.

**Nobody reads the history.** Every learning system starts at zero on install. Native auto memory starts empty on day one. `tellonce` needs two months of daily use to reach 280 rules. The same machine already holds 994 interruptions and 445 denials in `~/.claude/projects/`, and shadowclone starts from there on the first run.

**Nobody learns across vendors.** This is the strongest structural gap. Lians and `tellonce` inject into several tools but learn per tool. A profile built from Claude Code, Codex, and Cursor transcripts together can only come from a third party on the machine, because no vendor will read a competitor's logs.

**Nobody scopes by organization.** Native memory scopes per project directory path on disk. It has no concept of employer or client boundaries, and no controls governing cross-repository rule promotion or isolation. Shadowclone scopes rules to the organization they originated from, preventing work habits from leaking across corporate boundaries.

**Nobody compiles the person into dispatchable subagents.** Native auto memory maintains user and feedback notes for the current agent. Shadowclone compiles those steering moments into portable subagent definitions, dispatched in parallel to execute tasks with verified behavioral ceilings.

**Nobody runs on the subscription already paid for without vendor lock.** Hermes needs Nous Portal or keys. `mem0` runs a paid extraction model. Native auto memory is tied to one vendor. Shadowclone shells out to the authenticated CLI already on the machine across multiple providers, holding no API keys.

## What to borrow

TRACE shows that boundaries enforced as checks beat boundaries injected as instructions, by their numbers roughly 2 percent violations against 37 percent. Shadowclone cannot apply that result to bare tool-family denials. Until observation stores a privacy-safe action fingerprint that a live hook can reproduce, `boundaries.md` stays advisory in the system prompt rather than blocking every invocation of a tool.

The 20,574 session study's taxonomy, seven forms of misalignment covering how agents read projects, interpret intent, follow rules, bound actions, implement, and report progress, is a better category scheme for the mirror's output than anything invented here. The extractors should label into it.

## Positioning

One sentence, and every clause maps to a row above: shadowclone is the only tool that builds a profile of how a developer actually works from the agent transcripts already on disk, across vendors, scoped to the organization each habit came from, compiled into subagents that run as copies of that developer on the subscription they already pay for.

The honest caveat is that the correction-mining category has 7 stars and one paper in it. That is an open field and an unproven market at the same time, and the 241.7k stars on Hermes are the evidence that the appetite for an agent that grows with its user is real.
