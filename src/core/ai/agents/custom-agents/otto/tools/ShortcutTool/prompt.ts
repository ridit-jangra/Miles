export const DESCRIPTION =
  'Define and run named voice shortcuts — one command that fires a saved sequence of actions (open apps, start music, arrange the workspace).'

export const PROMPT = `A "voice shortcut" (e.g. "pixl mode") is a named macro: a saved list of shell steps that launch several things at once. Store it once, replay it whenever sir says the name.

Actions:
- define: save a shortcut. Pass 'name' and 'steps' — an ordered array of shell commands (e.g. ["code ~/Documents/Echo", "spotify", "playerctl play"]). Overwrites an existing shortcut of the same name. Steps launch detached, so don't append "&" yourself — just give the plain command to run an app or action.
- run: fire a saved shortcut by 'name'. Each step launches in order; you get back which launched.
- list: show all defined shortcuts and their steps.
- delete: remove a shortcut by 'name'.

Notes:
- When sir describes a new shortcut ("make 'pixl mode' open my editor, Slack, and music"), turn it into concrete launch commands and 'define' it, then confirm. Next time he says the name, just 'run' it.
- If sir asks to run a shortcut that isn't defined, say so and offer to set it up.
- Steps run through the same safety guards as the shell (no network-fetch commands, no touching protected paths). Keep steps to launching apps and local actions.`
