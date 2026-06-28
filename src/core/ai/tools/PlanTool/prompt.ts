export const DESCRIPTION = 'Write and track a step-by-step plan for a complex task.'

export const PROMPT = `Use this for any task that takes more than a couple of steps. Lay out the whole plan as a short list of concrete steps, then work through it top to bottom — updating each step's status as you go.

How to use it:
- At the start of a complex task, call this with the full list of steps, all 'pending'.
- Before doing a step, mark it 'in_progress'. After it's done, mark it 'completed' — pass the ENTIRE list each time (it replaces the stored plan).
- Keep exactly one step 'in_progress' at a time.
- Then just execute the steps yourself — run tools, delegate to subagents (dexter/hank/merlin/joker) where they fit — without stopping to ask sir between steps. Only pause if a step is genuinely destructive/irreversible or you're truly blocked.

Keep steps concrete and outcome-focused ("Search SearXNG for X", "Have Dexter post the summary to #team"), not vague.`
