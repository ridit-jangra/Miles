import { BrowserWindow } from 'electron'
import { tool } from 'ai'
import { z } from 'zod'

export const SpeakTool = tool({
  title: 'Speak',
  description:
    'Say something out loud to your dad/mom while you work. This is your VOICE — anything you pass here is spoken immediately by the TTS engine. Use it to keep them in the loop during a task: what you are about to do, what you just found, a quick heads-up that something will take a moment. Keep each line short and conversational, the way you would actually say it out loud. Do NOT use markdown, code, lists, or symbols — it gets read aloud literally. This does not end your turn; you keep working after speaking. For your final answer, just respond normally instead of using this tool.',
  inputSchema: z.object({
    text: z
      .string()
      .describe(
        'The line to speak out loud, phrased naturally as if talking to them. e.g. "Okay, looking at the build error now" or "Found it — give me a sec to fix this."'
      )
  }),
  execute: async ({ text }) => {
    const line = text?.trim()
    if (!line) return { success: false, error: 'empty text' }

    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    if (win && !win.isDestroyed()) {
      win.webContents.send('speak:say', line)
    }

    return { success: true, spoken: line }
  }
})
