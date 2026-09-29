# Why I built Shadowclone

I want to trust coding agents with substantial work in large repositories. I also want the result to follow my engineering standards. How much to change at once. How code should be organized. When to plan, test, or stop for review. Getting code written quickly is useful only if I can stay in control of those decisions.

I kept repeating the same preferences. The agent could often do the task, but I still had to explain how I wanted it done. More sessions and more agents meant more opportunities for those instructions to drift.

Instruction files and skills helped. Keeping them current was the harder part. Some described preferences I had changed. Others missed guidance that only came up when I corrected an agent. Switching tools meant maintaining another copy.

Shadowclone maintains that setup across the coding agents I use. It learns from the sessions I enable, updates the relevant skills, and carries them between agents. I can choose workflows, write preferences directly, and configure repository checks. The resulting skills and instructions remain files I can read and change.

The goal is to use agents confidently at scale while keeping my engineering preferences and guardrails intact. Changing agents should not mean starting that work over. Corrections should help future sessions, and I should decide what becomes a lasting rule.

## Built entirely with agents

I built Shadowclone without writing code by hand. Agents are better than me at producing code quickly. I set the requirements and guardrails, decide how the system should behave, and direct the agents toward those standards.

I do not consider that vibe coding. I care about the architecture, types, module boundaries, and tests, even when an agent writes every line. My responsibility for the result stays the same. Shadowclone exists because maintaining that control becomes harder as the work grows.

The repository has more than 800 source and test files. You can inspect it yourself or ask your coding agent to review it. Ask whether the design is coherent, whether the tests catch meaningful failures, and whether the code follows its own engineering rules. If you think it looks vibe coded, point to the code that led you there. The quality of the result is open to inspection.

## What matters to me

A correction should improve the next session without turning every interaction into a rule. A temporary exception should stay temporary. A preference from one project should stay in that project unless I explicitly make it global.

I want to see why guidance exists and undo a change I disagree with. Existing skills and memory should remain useful, and edits should preserve the work already in them.

Learning also needs evidence. The [evaluations](../README.md#evaluations) found that setups differ in how well an agent follows preferences, and that a first run exposed product defects that later runs fixed. The samples are small and cover one anonymized participant's preferences. They do not establish that maintained skills improve every task or save a particular amount of time. Guardrails help direct and check an agent's work; they cannot promise perfect adherence.

The project succeeds if it reduces the work of keeping an agent environment useful. Measuring that honestly includes reporting when extra guidance makes no difference or makes an agent worse.

## Keeping control

Coding sessions can contain sensitive material. Source access is opt-in, guidance stays editable, and changes are reversible. Model work uses the selected agent provider, so local storage does not mean the analysis stays offline. [Data handling](data-handling.md) explains that boundary.
