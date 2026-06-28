export const DESCRIPTION = 'Subscribe to Slack events so sir gets alerted when they happen.'

export const PROMPT = `Set up a standing watch on Slack. When a matching event arrives, sir is alerted (spoken + a banner) and can then tell you what to do about it.

Use this when sir says things like "tell me when a new message comes in #incidents", "ping me if I get mentioned anywhere", or "watch my DMs".

Actions:
- create — add a subscription. Pick the match type:
  - channel: any new message in a channel. You MUST pass the EXACT channelId returned by channels_list for that channel — never guess or fabricate an ID. If you haven't looked it up this turn, call channels_list first. Pass channelName too (for nice alerts).
  - mention: any message that @-mentions sir.
  - dm: any new direct message to sir.
  - keyword: messages containing a word/phrase (optionally scoped to a channel).
  Pass 'instructions' describing what sir wants — e.g. "summarize it" or "just notify me".
- list — show current subscriptions.
- remove — delete a subscription by its id.

Confirm what you set up in one line. Don't create duplicate subscriptions for the same thing.`
