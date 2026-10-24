import { useEffect, useState } from "react"

import { PixelSquare } from "./PixelSquare"
import { VoiceControls } from "./ui"
import { useVoice } from "../lib/voice"

function useSquareSize(): number {
  const measure = (): number => Math.round(Math.min(720, Math.max(140, Math.min(window.innerWidth * 0.8, window.innerHeight - 320))))
  const [size, setSize] = useState(measure)
  useEffect(() => {
    const onResize = (): void => setSize(measure())
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])
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
  const size = useSquareSize()
  const voice = useVoice()
  const live = voice.status === "live"
  const busy = voice.status === "connecting"
  const lastOf = (who: string): number => voice.lines.map((line) => line.who).lastIndexOf(who as "you")
  const lastBot = lastOf("miles")
  const lastYou = lastOf("you")
  const botText = lastBot > lastYou ? voice.lines[lastBot].text : ""
  const showBot = useLingering(voice.speaking, 6000) && botText !== ""

  const toggle = (): void => {
    void (live ? voice.disconnect() : voice.connect())
  }

  return (
    <div className="pointer-events-none fixed inset-y-0 left-[45%] z-[1] flex w-[min(640px,90vw)] -translate-x-1/2 flex-col items-center justify-center gap-6 text-center">
      <PixelSquare level={voice.level} speaking={voice.speaking} thinking={voice.thinking} connecting={voice.status === "connecting"} size={size} className="mt-20" />

      <div className="flex flex-col items-center gap-5">
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
        <div className="pointer-events-auto flex gap-2">
          <VoiceControls live={live} muted={voice.muted} busy={busy} onToggle={toggle} onMute={voice.toggleMute} />
        </div>
      </div>
    </div>
  )
}
