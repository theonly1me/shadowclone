# Why I built Shadowclone

I want to trust coding agents with large changes in large repositories. I also want the result to follow my engineering standards. These standards cover how much to change at once, how to organize code, and when to plan, test, or stop for review. Fast code helps only if I stay in control of those decisions.

I kept repeating the same preferences. The agent could often do the task, but I still had to explain how I wanted it done. More sessions and more agents gave those instructions more chances to drift.

Instruction files and skills helped. Keeping them current was the hard part. Some described preferences that I had changed. Others missed guidance that came up only when I corrected an agent. Each new tool meant another copy to maintain.

Shadowclone maintains that setup across the coding agents that I use. It learns from the sessions that I enable, updates the relevant skills, and carries them between agents. The same skills also drive a cloud bot on GitHub. I can choose workflows, write preferences, and set repository checks. The skills and instructions stay as files that I can read and change.

The goal is to use agents with confidence at scale and keep my engineering preferences and guardrails. A change of agent should not restart that work. Corrections should help future sessions, and I decide what becomes a lasting rule.

## Built entirely with agents

I built Shadowclone without writing code by hand. Agents write code faster than I do. I set the requirements and the guardrails, I decide how the system must behave, and I direct the agents to those standards.

I do not call that vibe coding. I care about the architecture, the types, the module boundaries, and the tests, even when an agent writes every line. My responsibility for the result stays the same. Shadowclone exists because that control gets harder to keep as the work grows.

The repository has more than 800 source and test files. You can inspect it, or ask your coding agent to review it. Ask whether the design is coherent, whether the tests catch real failures, and whether the code follows its own engineering rules. If you think it looks vibe coded, point to the code that made you think so. The quality of the result is open to inspection.

## What matters to me

A correction should improve the next session without turning every interaction into a rule. A temporary exception should stay temporary. A preference from one project should stay in that project unless I make it global on purpose.

I want to see why guidance exists and undo a change that I disagree with. Existing skills and memory should stay useful, and edits should keep the work that is already in them.

Learning also needs evidence. The [evaluations](../evals.md) show that setups differ in how well an agent follows preferences. They also show that a first run exposed product defects that later runs fixed.

The tests use 24 fixed synthetic tasks. They do not show that maintained skills improve every task or save a set amount of time. Guardrails help direct and check an agent. They cannot promise perfect adherence.

The project succeeds if it reduces the work of keeping an agent environment useful. An honest measurement reports when extra guidance makes no difference or makes an agent worse.

## Keeping control

Coding sessions can hold sensitive material. Source access is opt-in, guidance stays editable, and changes are reversible. Model work uses the agent provider that you select, so local storage does not mean that the analysis stays offline. [Data handling](data-handling.md) explains that boundary.

## Related approaches

Shadowclone maintains guidance that existing coding agents use. Instruction files, skills, and memory stay part of that setup.

| Approach                | Useful for                                | Maintenance concern                                              |
| ----------------------- | ----------------------------------------- | ---------------------------------------------------------------- |
| Repository instructions | Explicit project conventions              | Keeping them current and readable by the chosen agents           |
| Personal skills         | Reusable task workflows                   | Routing, ownership, supporting resources, and conflicting copies |
| Native memory           | Context carried between sessions          | Scope, accuracy, retention, and correction                       |
| Transcript analysis     | Finding repeated steering and corrections | Consent and whether evidence justifies durable guidance          |
| Evaluation              | Checking behavior under stated guidance   | Fair baselines, judge errors, and correctness                    |

Shadowclone reads enabled sessions and memory, reconciles durable guidance, and updates the relevant skills. It keeps evidence and revisions on your machine, so you can inspect or reverse a change. Native instructions route agents to the right workflows.

The installed agent CLI avoids a separate credential setup. Requests follow the limits of the provider, and they send authorized input to that provider. [Data handling](data-handling.md) describes these boundaries.

Well-maintained instructions may already give you what you need. The useful comparison is the effort and the quality of keeping that setup current. More guidance can help, change nothing, or cause a conflict.
