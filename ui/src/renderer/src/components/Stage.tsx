import { useEffect, useRef, useState } from "react"

import { Chat } from "./Chat"
import { PixelSquare } from "./PixelSquare"
import { VoiceControls } from "./ui"
import { useVoice } from "../lib/voice"

// the blob is sized from the pane it sits in, not the window
function useSquareSize(box: React.RefObject<HTMLDivElement | null>): number {
  const [size, setSize] = useState(240)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const measure = (): void =>
      setSize(Math.round(Math.min(720, Math.max(140, Math.min(el.clientWidth * 0.8, el.clientHeight - 260)))))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [box])
  return size
}

function useLingering(active: boolean, ms: number): boolean {
  const [shown, setShown] = useState(active)
  useEffect(() => {
    if (active) {
      setShown(true)
      return
    }
    const timer = setTimeout(() => setShown(false), ms)
    return () => clearTimeout(timer)
  }, [active, ms])
  return shown
}

export function Stage(): React.JSX.Element {
  const box = useRef<HTMLDivElement>(null)
  const size = useSquareSize(box)
  const voice = useVoice()
  const live = voice.status === "live"
  const busy = voice.status === "connecting"
  const lastOf = (who: string): number => voice.lines.map((line) => line.who).lastIndexOf(who as "you")
  const lastBot = lastOf("miles")
  const lastYou = lastOf("you")
  const botText = lastBot > lastYou ? voice.lines[lastBot].text : ""
  const showBot = useLingering(voice.speaking, 6000) && botText !== ""

  const [chat, setChat] = useState(false)

  const toggle = (): void => {
    void (live ? voice.disconnect() : voice.connect())
  }

  // chat is typed, so keep the mic off while it's open
  const mutedByChat = useRef(false)
  useEffect(() => {
    if (chat && live && !voice.muted && !mutedByChat.current) {
      mutedByChat.current = true
      voice.toggleMute()
    } else if (!chat && mutedByChat.current) {
      mutedByChat.current = false
      if (voice.muted) voice.toggleMute()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat, live])

  const toggleChat = (): void => {
    if (!chat && !live) void voice.connect()
    setChat(!chat)
  }

  return (
    <div ref={box} className="relative flex h-full w-full flex-col items-center justify-center gap-6 px-6 py-4 text-center">
      {chat ? (
        <Chat
          controls={<VoiceControls live={live} muted={voice.muted} busy={busy} chat={chat} onToggle={toggle} onMute={voice.toggleMute} onChat={toggleChat} />}
        />
      ) : (
        <PixelSquare level={voice.level} speaking={voice.speaking} thinking={voice.thinking} connecting={voice.status === "connecting"} size={size} className="animate-enter motion-reduce:animate-none" />
      )}

      {!chat && (
        <div className="flex w-full max-w-[640px] animate-enter flex-col items-center gap-5 motion-reduce:animate-none">
          <div
            aria-live="polite"
            className={`line-clamp-4 max-w-full h-[4rem] flex items-center justify-center text-ui leading-normal text-ink-mid transition-opacity duration-500 ${
              voice.userText || showBot ? "opacity-100" : "opacity-0"
            }`}
          >
            {voice.userText && <span className="block">{voice.userText}</span>}
            {showBot && <span className="block">{botText}</span>}
          </div>
          {voice.error && <p className="text-note text-ink-dim">{voice.error}</p>}
          <div className="flex gap-2">
            <VoiceControls live={live} muted={voice.muted} busy={busy} chat={chat} onToggle={toggle} onMute={voice.toggleMute} onChat={toggleChat} />
          </div>
        </div>
      )}
    </div>
  )
}
