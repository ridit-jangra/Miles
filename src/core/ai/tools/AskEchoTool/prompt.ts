export const DESCRIPTION = 'Ask sir a question mid-task (relayed in Echo’s voice) and wait for his answer.'

export const PROMPT = `Use this when you genuinely need sir's input to continue and can't safely guess — a real fork (which channel, which account, approve a risky action, a missing detail). It speaks your question to sir in Echo's voice and BLOCKS until he answers, then returns his reply as the tool result — so you keep all your context and resume exactly where you left off, instead of stopping and losing your progress.

Phrase the question as ONE clear, self-contained spoken sentence, the way sir should hear it — include just enough context and the concrete options (e.g. "For the pixl RSVP check, should I post in construction or construction-private?"). No markdown, no lists.

Use it sparingly — only for true blockers. Don't ask what you can reasonably decide yourself or look up with another tool. If sir doesn't answer in a few minutes you'll get a note to proceed on your best judgment; handle that gracefully. This is NOT for progress updates (use NotifyTool) or your final answer (return that).`
