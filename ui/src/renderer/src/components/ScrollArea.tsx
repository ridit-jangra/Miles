import { useCallback, useEffect, useRef, useState } from "react"

import { cn } from "../lib/cn"

const MIN_THUMB = 28

export function ScrollArea(props: { className?: string; children: React.ReactNode }): React.JSX.Element {
  const view = useRef<HTMLDivElement>(null)
  const drag = useRef<{ startY: number; startTop: number } | null>(null)
  const [thumb, setThumb] = useState({ top: 0, height: 0, visible: false })
  const [active, setActive] = useState(false)

  const measure = useCallback(() => {
    const el = view.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    if (scrollHeight <= clientHeight + 1) {
      setThumb((t) => (t.visible ? { top: 0, height: 0, visible: false } : t))
      return
    }
    const height = Math.max(MIN_THUMB, (clientHeight / scrollHeight) * clientHeight)
    const top = (scrollTop / (scrollHeight - clientHeight)) * (clientHeight - height)
    setThumb({ top, height, visible: true })
  }, [])

  useEffect(() => {
    const el = view.current
    if (!el) return
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    Array.from(el.children).forEach((child) => observer.observe(child))
    return () => observer.disconnect()
  }, [measure])

  const onThumbDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { startY: event.clientY, startTop: thumb.top }
    setActive(true)
  }

  const onThumbMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const el = view.current
    if (!drag.current || !el) return
    const room = el.clientHeight - thumb.height
    const top = Math.min(room, Math.max(0, drag.current.startTop + event.clientY - drag.current.startY))
    el.scrollTop = (top / room) * (el.scrollHeight - el.clientHeight)
  }

  const onThumbUp = (): void => {
    drag.current = null
    setActive(false)
  }

  const onTrackDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    const el = view.current
    if (!el || event.target !== event.currentTarget) return
    const rect = event.currentTarget.getBoundingClientRect()
    el.scrollBy({ top: event.clientY < rect.top + thumb.top ? -el.clientHeight : el.clientHeight, behavior: "smooth" })
  }

  return (
    <div className={cn("group/scroll relative min-h-0", props.className)}>
      <div ref={view} onScroll={measure} className="h-full max-h-[inherit] overflow-y-auto pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex flex-col gap-3.5">{props.children}</div>
      </div>
      {thumb.visible && (
        <div
          onPointerDown={onTrackDown}
          className={cn(
            "absolute top-0 right-0 bottom-0 w-2 opacity-0 transition-opacity duration-150 group-hover/scroll:opacity-100",
            active && "opacity-100",
          )}
        >
          <div
            onPointerDown={onThumbDown}
            onPointerMove={onThumbMove}
            onPointerUp={onThumbUp}
            onPointerCancel={onThumbUp}
            style={{ transform: `translateY(${thumb.top}px)`, height: thumb.height }}
            className={cn(
              "absolute inset-x-0 top-0 cursor-grab touch-none rounded-full bg-edge transition-colors duration-120 hover:bg-ink-mid",
              active && "cursor-grabbing bg-ink",
            )}
          />
        </div>
      )}
    </div>
  )
}
