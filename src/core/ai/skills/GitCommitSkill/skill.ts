/* eslint-disable prettier/prettier */
import type { Skill } from '../../types'

const content = `
---
name: git-commit
description: Generate accurate, conventional commit messages by reading actual git diffs. Use this skill whenever the user asks for a commit message, wants to commit changes, says "what should I commit", "write a commit", "commit this", or anything involving summarizing code changes into a git commit. Never generate a commit message without reading the diff first. Always use conventional commits format.
---

This skill generates honest, precise commit messages grounded in what actually changed — not what the user thinks changed or what they tell you.

## The Rule

**Never generate a commit message without running \`git status && git diff\` (unix) or \`git status; git diff\` (windows) first.** No exceptions. Not even if the user describes the changes. You read the diff yourself.

## Step-by-Step

1. **Read the diff** — Run \`git status && git diff\` (staged: \`git diff --cached\`). If both are empty, tell the user there's nothing to commit.
2. **Understand what actually changed** — Don't skim. Read every file. Note: what was added, removed, renamed, restructured.
3. **Identify the dominant change** — One commit = one logical unit. If there are 5 unrelated changes, say so and suggest splitting.
4. **Write the message** — Conventional commits format, always.

## Conventional Commits Format

\`\`\`
<type>(<scope>): <short summary>

<optional body>

<optional footer>
\`\`\`

**Types:**
- \`feat\` — new feature or capability
- \`fix\` — bug fix
- \`refactor\` — restructuring without behavior change
- \`chore\` — tooling, deps, config, build
- \`docs\` — documentation only
- \`test\` — adding or updating tests
- \`style\` — formatting, whitespace, no logic change
- \`perf\` — performance improvement

**Rules for the summary line:**
- Lowercase, no period at end
- Under 72 characters
- Imperative mood: "add", "fix", "remove" — not "added", "fixes", "removed"
- Specific: "fix null pointer in auth middleware" not "fix bug"

**When to include a body:**
- Non-obvious reasoning ("why" not "what")
- Breaking changes
- Multiple related changes worth enumerating
- Migration notes

## Quality Bar

Good: \`feat(auth): add refresh token rotation with 7-day expiry\`
Bad: \`update stuff\`
Bad: \`fixed the thing that was broken\`
Bad: \`feat: changes\` (vague)
Bad: \`feat(everything): big update\` (too broad — suggest splitting)

## Edge Cases

- **Staged vs unstaged**: Check both. Ask the user which they want to commit if mixed.
- **Untracked files**: Flag them. Ask if they should be included.
- **Large diffs spanning multiple concerns**: Flag it. Suggest \`git add -p\` to split.
- **Merge commits**: Just use \`merge: <branch> into <branch>\` — don't overthink it.
- **First commit**: \`chore: initial commit\` or \`feat: bootstrap <project-name>\` depending on what's there.

## Tone

Give the commit message. If it's complex, briefly explain why you chose the type/scope. Don't pad. Don't ask "does this look good?" — just give it and let them edit if needed.
`

const description =
  'Generate accurate, conventional commit messages by reading actual git diffs. Use this skill whenever the user asks for a commit message, wants to commit changes, says "what should I commit", "write a commit", "commit this", or anything involving summarizing code changes into a git commit. Never generate a commit message without reading the diff first. Always use conventional commits format.'

export const GitCommitSkill: Skill = {
  content,
  description
}
