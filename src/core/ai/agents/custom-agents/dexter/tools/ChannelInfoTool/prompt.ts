export const DESCRIPTION = "Get a Slack channel's metadata, including its live member count."

export const PROMPT = `Fetch details for a single Slack channel by ID — member count (num_members), name, topic, purpose, and whether it's private or archived. This is the ONLY way to get a channel's member count: the channels_list tool can't reliably filter, and there is no other member-count source.

Pass the channel ID (starts with C, G, or D), not a #name — e.g. C0B5P4N0WHH. If you only know the #name, recall the ID from memory or a message permalink first. Use this whenever sir asks how many people are in a channel, or for a channel's topic/purpose/status.`
