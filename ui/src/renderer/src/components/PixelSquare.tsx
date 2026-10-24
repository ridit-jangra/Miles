import { useEffect, useRef } from "react"

const CELL = 13
const FADE_LAYERS = 3

export function PixelSquare(props: { level: React.RefObject<number>; speaking: boolean; thinking: boolean; connecting: boolean; size: number }): React.JSX.Element {
  const { level, speaking, thinking, connecting, size } = props
  const canvas = useRef<HTMLCanvasElement>(null)
  const speakingRef = useRef(speaking)
  speakingRef.current = speaking
  const thinkingRef = useRef(thinking)
  thinkingRef.current = thinking
  const connectingRef = useRef(connecting)
  connectingRef.current = connecting

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext("2d")
    if (!el || !ctx) return
    const dpr = window.devicePixelRatio || 1
    el.width = size * dpr
    el.height = size * dpr
    ctx.scale(dpr, dpr)

    const GRID = Math.max(12, Math.round(size / CELL))
    const cell = size / GRID
    const seeds = Array.from({ length: GRID * GRID }, () => Math.random() * Math.PI * 2)
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let energy = 0
    let think = 0
    let link = 0
    let frame = 0
    let last = 0
    let raf = 0

    const draw = (now: number): void => {
      raf = requestAnimationFrame(draw)
      if (now - last < 40) return
      last = now
      frame = now / 1000

      const target = speakingRef.current ? Math.max(0.35, Math.min(1, (level.current ?? 0) * 3)) : 0
      energy += (target - energy) * 0.18
      think += ((thinkingRef.current && !speakingRef.current ? 1 : 0) - think) * 0.1
      link += ((connectingRef.current ? 1 : 0) - link) * 0.12
      const power = reduced ? 0 : energy
      const spin = reduced ? 0 : think

      ctx.clearRect(0, 0, size, size)
      const mid = (GRID - 1) / 2
      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          const dx = x - mid
          const dy = y - mid
          const dist = Math.hypot(dx, dy) / mid
          const wave = Math.sin(dist * 7 - frame * 6 + seeds[y * GRID + x] * 0.35)
          const lift = power * Math.max(0, wave)
          const idle = 0.5 + 0.5 * Math.sin(frame * 0.8 + seeds[y * GRID + x])
          const layer = Math.min(x, y, GRID - 1 - x, GRID - 1 - y)
          const fade = layer >= FADE_LAYERS ? 1 : (layer + 0.5) / (FADE_LAYERS + 0.5)
          const grain = (seeds[y * GRID + x] / (Math.PI * 2) + frame * 0.05) % 1
          if (fade < 1 && grain > fade + 0.15) continue
          const base = 0.1 + 0.07 * idle
          const angle = Math.atan2(dy, dx)
          const arm = Math.cos(angle - frame * 2.4)
          const sweep = spin * Math.pow(Math.max(0, arm), 6) * (0.35 + 0.65 * dist) * (dist > 0.12 ? 1 : 0)
          const ring = Math.max(Math.abs(dx), Math.abs(dy)) / mid
          const front = (frame * 0.7) % 1.25
          const hop = link * (reduced ? 0 : Math.max(0, 1 - Math.abs(ring - front) * 5))
          const pulse = spin * 0.12 * (0.5 + 0.5 * Math.sin(frame * 3 - dist * 3))
          const alpha = Math.min(1, base + lift * 0.85 + sweep * 0.9 + pulse + hop * 0.9) * fade
          const shrink = 1 - 0.28 * (1 - Math.min(1, lift * 1.4 + sweep * 1.2 + hop + 0.2))
          const px = cell * shrink
          const jitter = power * 3 * Math.sin(frame * 9 + seeds[y * GRID + x]) * (1 - dist * 0.5)
          const ox = x * cell + (cell - px) / 2 + (dx / mid) * lift * 5 + jitter * 0.4
          const oy = y * cell + (cell - px) / 2 + (dy / mid) * lift * 5
          ctx.fillStyle = `rgba(10,10,12,${(0.94 * fade).toFixed(3)})`
          ctx.fillRect(x * cell, y * cell, cell + 0.5, cell + 0.5)
          ctx.fillStyle = `rgba(233,230,225,${alpha.toFixed(3)})`
          ctx.fillRect(ox, oy, px - 1, px - 1)
        }
      }
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [level, size])

  return <canvas ref={canvas} data-ascii-hole className="mt-20" style={{ width: size, height: size }} aria-hidden />
}
