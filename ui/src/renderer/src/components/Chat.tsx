import { useEffect, useRef, useState } from "react"

import { cn } from "../lib/cn"
import { ScrollArea } from "./ScrollArea"
import { useVoice } from "../lib/voice"

// from Milo's Spinner: the "star" spinner frames (70ms) and its pool of messages
const STAR = ["✶", "✸", "✹", "✺", "✹", "✷"]
const MESSAGES = [
  "Sniffing…", "Pawing…", "Purring…", "Staring…", "Vibing…", "We move", "Cooking…", "Napping…",
  "Meow meow", "Understood", "Feral rn", "Cat brain", "No cap", "Fr fr", "Slay mode", "Pouncing…",
  "Zooming…", "Plotting…",
]

function Thinking(): React.JSX.Element {
  const [frame, setFrame] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [message] = useState(() => MESSAGES[Math.floor(Math.random() * MESSAGES.length)])

  useEffect(() => {
    const started = Date.now()
    const spin = setInterval(() => setFrame((f) => (f + 1) % STAR.length), 70)
    const clock = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => {
      clearInterval(spin)
      clearInterval(clock)
    }
  }, [])

  return (
    <div aria-label="miles is thinking" className="flex items-center gap-2.5 self-start px-3 py-2 font-display text-ui">
      <span aria-hidden className="w-4 text-center text-ink">
        {STAR[frame]}
      </span>
      <span className="text-ink">{message}</span>
      <span className="text-note text-ink-dim">({seconds}s)</span>
    </div>
  )
}

export function Chat(props: { controls: React.ReactNode }): React.JSX.Element {
  const voice = useVoice()
  const live = voice.status === "live"
  const [draft, setDraft] = useState("")
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" })
  }, [voice.lines, voice.thinking])

  const submit = (): void => {
    if (!draft.trim() || !live) return
    voice.sendText(draft)
    setDraft("")
  }

  return (
    <div className="flex h-full min-h-0 w-full animate-enter flex-col gap-3 text-left motion-reduce:animate-none">
      {voice.lines.length === 0 && !voice.thinking ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          {voice.status === "connecting" ? (
            <div className="flex flex-col items-center gap-3">
              <p className="font-display text-[19px] text-ink-dim">connecting…</p>
              <div className="h-0.5 w-40 overflow-hidden rounded-full bg-edge">
                <div className="h-full w-2/5 animate-slide rounded-full bg-ink motion-reduce:animate-none" />
              </div>
            </div>
          ) : (
            <p className="font-display text-[19px] text-ink-dim">{live ? "type something to start" : "connect to start chatting"}</p>
          )}
        </div>
      ) : (
      <div className="relative min-h-0 flex-1">
      <ScrollArea className="absolute inset-0">
        {voice.lines.map((line) =>
          line.who === "tool" ? (
            <p key={line.id} className="text-note text-ink-dim">
              used {line.text}
            </p>
          ) : (
            <div
              key={line.id}
              className={cn(
                "max-w-[80%] cursor-text rounded-control px-3 py-2 font-display text-ui leading-normal whitespace-pre-wrap [overflow-wrap:anywhere] select-text selection:bg-ink selection:text-on-light",
                line.who === "you" ? "self-end bg-lift text-ink" : "self-start text-ink",
              )}
            >
              {line.text}
            </div>
          ),
        )}
        {voice.thinking && <Thinking />}
        <div ref={end} />
      </ScrollArea>
      </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex">{props.controls}</div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
          className="flex items-stretch gap-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={!live}
            placeholder={live ? "type to miles" : "not connected"}
            className="min-w-0 flex-1 rounded-control border border-edge bg-lift px-3 py-3 font-display text-[19px] text-ink outline-none transition-colors duration-120 placeholder:text-ink-dim focus-visible:border-ink disabled:opacity-55"
          />
          <button
            type="submit"
            disabled={!live || !draft.trim()}
            className="cursor-pointer rounded-control min-w-28 border border-ink bg-ink px-8 font-display text-[19px] font-medium text-on-light outline-none transition-colors duration-120 hover:bg-surface hover:text-ink focus-visible:bg-surface focus-visible:text-ink disabled:cursor-default disabled:opacity-55 disabled:hover:bg-ink disabled:hover:text-on-light"
          >
            send
          </button>
        </form>
      </div>
    </div>
  )
}
