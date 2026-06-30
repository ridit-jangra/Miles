import React, { useEffect, useRef } from 'react'

type SpokenCaptionProps = {
  text: string
  progress: number
  active: boolean
}

export function SpokenCaption({ text, progress, active }: SpokenCaptionProps): React.JSX.Element {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const activeIndex = Math.min(words.length - 1, Math.floor(progress * words.length))

  const containerRef = useRef<HTMLDivElement | null>(null)
  const activeRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      activeRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest'
      })
    }
  }, [activeIndex])

  if (!text) return <></>

  return (
    <div
      ref={containerRef}
      className="max-w-[80vw] overflow-hidden whitespace-nowrap font-mono text-2xl px-10 py-5 rounded-md bg-black/50 flex items-center gap-2"
      style={{ opacity: active ? 1 : 0.5, transition: 'opacity 0.3s' }}
    >
      {words.map((word, i) => {
        const isActive = i === activeIndex
        const isPast = i < activeIndex
        return (
          <span
            key={i}
            ref={isActive ? activeRef : null}
            className="mx-1 transition-all duration-200"
            style={{
              color: isActive
                ? '#fff'
                : isPast
                  ? 'rgba(255,255,255,0.4)'
                  : 'rgba(255,255,255,0.25)',
              background: isActive ? '#D97757' : 'transparent'
            }}
          >
            {word}
          </span>
        )
      })}
    </div>
  )
}
