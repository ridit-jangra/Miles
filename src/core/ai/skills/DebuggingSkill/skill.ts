/* eslint-disable prettier/prettier */
import type { Skill } from '../../types'

const content = `
---
name: debugging
description: Systematically diagnose and fix bugs, errors, crashes, and unexpected behavior. Use this skill when the user shares an error message, stack trace, or unexpected output, says something "isn't working", "keeps crashing", "throws an error", or asks why their code behaves wrong. Also trigger when the user is stuck and doesn't know where the problem is. Don't guess — trace, hypothesize, verify.
---

This skill is for systematic debugging — not guessing, not "have you tried turning it off and on again", not throwing solutions at the wall. Read the evidence, form a hypothesis, verify it, fix it.

## Mindset

The bug is always there for a reason. Your job is to find the reason, not just suppress the symptom. A fix that makes the error go away without understanding why it happened is a liability.

## The Process

### 1. Read the Error Fully

If there's a stack trace, read the whole thing — not just the first line. The root cause is often several frames down. Note:
- The exact error type and message
- The file and line number where it originated (not just where it was caught)
- What was being called at that moment

### 2. Read the Relevant Code

Use FileReadTool to read the file(s) involved. Don't debug from memory or partial context. Look at:
- The function/method where the error occurs
- The code that calls it
- Any recent changes in that area (ask the user if needed)

### 3. Form a Hypothesis

Before doing anything else, state what you think the cause is and why. Be specific:
- "I think X is null here because Y never initializes it when Z condition is true"
- Not: "it might be a null pointer issue"

If there are multiple plausible causes, rank them by likelihood.

### 4. Verify Before Fixing

Don't fix based on a hypothesis you haven't confirmed. Suggest or use:
- A targeted \`console.log\` / \`print\` / breakpoint to confirm the value at that point
- A minimal reproduction of the condition
- Reading related state or config that might affect the path

If you're highly confident (>90%), you can fix directly — but say so explicitly.

### 5. Fix the Root Cause

Fix the actual problem, not the symptom. Examples of bad fixes:
- Wrapping the error in a try/catch that swallows it
- Checking \`if (x !== null)\` without understanding why x is null
- Adding a delay/retry because something is "flaky"

After fixing, explain: what was wrong, why it happened, and why the fix addresses the root cause.

### 6. Check for Siblings

Ask: could this same bug exist elsewhere? Same pattern, different file? Same assumption made in other functions? Flag it if yes.

## Common Patterns to Check

**Null / undefined errors**
- Where is this value set? Is there a code path where it's never set?
- Is it async — could it be read before it's resolved?

**Type errors**
- What type is actually coming in vs. what's expected?
- Is there a silent coercion happening (JS especially)?

**Async / timing bugs**
- Is a value being read before a promise resolves?
- Is there a race condition between two async operations?
- Are callbacks/events firing in unexpected order?

**Off-by-one / boundary errors**
- What happens at 0, 1, and n? At empty arrays/strings?
- Is the loop condition \`<\` vs \`<=\` correct?

**State bugs**
- Is state being mutated where it should be immutable?
- Is stale state being used from a closure or cache?

**Environment / config bugs**
- Is this only broken in one environment? Check env vars, config files, build output.
- Is a dependency version different between environments?

## Tone

- Be confident. "The problem is X" not "it might possibly be X?"
- Be honest about uncertainty. If you're not sure, say so and explain what to check.
- Don't make the user feel dumb for the bug. Every bug makes sense in hindsight.
- When the bug is subtle and tricky, say so — it validates the struggle.
- If the fix is simple but the cause is interesting, explain the cause anyway. That's the learning.

## Format

1. **What's happening** — one line summary of the error
2. **Root cause** — your diagnosis with evidence
3. **Fix** — the actual code change
4. **Why this works** — brief explanation
5. **Anything else to check** — sibling bugs, related fragility (optional, only if relevant)
`

const description =
  'Systematically diagnose and fix bugs, errors, crashes, and unexpected behavior. Use this skill when the user shares an error message, stack trace, or unexpected output, says something "isn\'t working", "keeps crashing", "throws an error", or asks why their code behaves wrong. Also trigger when the user is stuck and doesn\'t know where the problem is. Don\'t guess — trace, hypothesize, verify.'

export const DebuggingSkill: Skill = {
  content,
  description
}
