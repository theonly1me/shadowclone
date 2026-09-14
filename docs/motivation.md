# Why I built Shadowclone

I kept repeating the same preferences to coding agents. How much to change at once. How I wanted code organized. When I wanted a plan before edits. The agent could often do the task, but I still had to explain how I wanted it done.

Instruction files and skills helped. I do not think they are a bad approach. The problem was keeping them current and carrying them between tools. Some instructions reflected an older preference. Others had never been written down because they came up as corrections during ordinary work.

That is the problem I am trying to solve with Shadowclone. It reads the sessions a user explicitly enables, looks for reusable guidance, and keeps an editable profile that can be supplied to their existing coding agent. It can also keep personal skills synchronized. It does not train a new model or turn every past action into an instruction.

## What I want it to get right

I want to repeat myself less without losing control over what the agent learns. A temporary exception should stay temporary. An interruption should not automatically become a preference. A rule learned in one repository should not quietly appear in an unrelated one.

The profile needs to be readable and correctable. I want to see what was learned, change wording I disagree with, and remove guidance that no longer fits. If the profile becomes another large instruction file that I cannot understand or maintain, the project has missed its purpose.

Normal sessions are the starting point. Delegated work can use the same profile, but I do not want useful guidance to depend on adopting a new agent or running everything through a custom subagent.

## What the early results tell me

In a small four-task comparison, the profile-equipped setup followed more of the measured preferences than the repository-only baseline. It also scored above the existing skills setup on two tasks and tied on two. That is encouraging, but the sample is small and the judges still made mistakes. The [evaluation write-up](../evals.md) includes the tasks, scores, and those limitations.

I do not have evidence for a productivity multiplier or a claim that a profile always beats well-maintained instructions. The useful question is narrower: does it help the agent follow the guidance the user actually wants on the next task? A tie or a loss is worth reporting too.

## What I am not willing to trade away

These sessions can contain sensitive material. Learning has to be opt-in, the derived profile has to stay under the user's control, and model use has to be explicit. Local storage does not mean that analysis stays offline: eligible redacted excerpts go through the selected authenticated agent CLI. Evaluation also exposes the chosen repository snapshot and generated code to that provider.

The current system is still early. Redaction is not a guarantee of anonymity, guidance can be wrong, and extra instructions can make an agent worse. I want the project to make those failures visible and easy to correct. That seems more useful than promising a perfect copy of how someone works.
