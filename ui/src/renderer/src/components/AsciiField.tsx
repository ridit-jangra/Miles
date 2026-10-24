import { useEffect, useRef } from "react"

const RAMP = [" ", ".", ":", "-", "=", "+", "*", "#", "%", "@"]
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16)
const HOLE_FEATHER = 70
const FONT_FAMILY = '"Geist Mono Variable", ui-monospace, monospace'

const fract = (x: number): number => x - Math.floor(x)
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const hash = (x: number, y: number): number => {
  let px = fract(x * 123.34)
  let py = fract(y * 345.45)
  const d = px * (px + 34.345) + py * (py + 34.345)
  px += d
  py += d
  return fract(px * py)
}
const noise = (x: number, y: number): number => {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const a = hash(ix, iy)
  const b = hash(ix + 1, iy)
  const c = hash(ix, iy + 1)
  const d = hash(ix + 1, iy + 1)
  return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy
}
const fbm = (x: number, y: number): number => {
  let value = 0
  let amp = 0.5
  for (let i = 0; i < 4; i++) {
    value += amp * noise(x, y)
    x = x * 1.9 + 11.3
    y = y * 1.9 + 5.7
    amp *= 0.5
  }
  return value
}

type Props = {
  cell?: number
  speed?: number
  strength?: number
}

export function AsciiField({ cell = 14, speed = 1, strength = 0.7 }: Props): React.JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext("2d")
    if (!el || !ctx) return

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const cw = Math.round(cell * 0.62)
    const ch = cell
    let atlas: HTMLCanvasElement | null = null
    let cols = 0
    let rows = 0
    let dpr = 1
    let frame = 0
    let last = 0
    let stopped = false

    const buildAtlas = (): void => {
      const a = document.createElement("canvas")
      a.width = cw * dpr * RAMP.length
      a.height = ch * dpr * 2
      const g = a.getContext("2d")
      if (!g) return
      g.scale(dpr, dpr)
      g.font = `${Math.round(cell * 0.92)}px ${FONT_FAMILY}`
      g.textBaseline = "middle"
      g.textAlign = "center"
      RAMP.forEach((glyph, i) => {
        g.fillStyle = "rgba(164, 156, 148, 0.5)"
        g.fillText(glyph, i * cw + cw / 2, ch / 2 + 1)
        g.fillStyle = "rgba(233, 230, 225, 0.9)"
        g.fillText(glyph, i * cw + cw / 2, ch + ch / 2 + 1)
      })
      atlas = a
    }

    const resize = (): void => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = window.innerWidth
      const h = window.innerHeight
      el.width = Math.floor(w * dpr)
      el.height = Math.floor(h * dpr)
      cols = Math.ceil(w / cw)
      rows = Math.ceil(h / ch)
      buildAtlas()
    }

    const draw = (time: number): void => {
      if (!atlas) return
      const t = time * 0.001 * speed
      ctx.clearRect(0, 0, el.width, el.height)
      const levels = RAMP.length - 1
      const hole = document.querySelector("[data-ascii-hole]")?.getBoundingClientRect()
      for (let y = 0; y < rows; y++) {
        const v = (y + 0.5) / rows
        for (let x = 0; x < cols; x++) {
          const u = (x + 0.5) / cols
          const wave = 0.5 + 0.5 * Math.sin(x * 0.045 + y * 0.07 + t * 0.55)
          const grain = fbm(x * 0.045 + t * 0.07, y * 0.075 - t * 0.05)
          let value = (grain * 0.75 + wave * 0.25) * strength * 2
          const dx = (u - 0.5) * 2
          const dy = (v - 0.5) * 2
          value *= 0.25 + 0.75 * smooth(0.18, 0.95, Math.sqrt(dx * dx * 1.1 + dy * dy * 0.35))
          value = Math.pow(Math.max(0, value), 2.1)
          if (hole) {
            const px = x * cw + cw / 2
            const py = y * ch + ch / 2
            const gap = Math.hypot(Math.max(hole.left - px, 0, px - hole.right), Math.max(hole.top - py, 0, py - hole.bottom))
            value *= smooth(0, HOLE_FEATHER, gap)
          }
          const threshold = BAYER[(y & 3) * 4 + (x & 3)]
          const index = Math.min(levels, Math.max(0, Math.floor(value * levels + threshold - 0.5 + 0.5)))
          if (index === 0) continue
          const bright = index >= levels - 1 ? 1 : 0
          ctx.drawImage(atlas, index * cw * dpr, bright * ch * dpr, cw * dpr, ch * dpr, x * cw * dpr, y * ch * dpr, cw * dpr, ch * dpr)
        }
      }
    }

    const tick = (time: number): void => {
      if (stopped) return
      frame = requestAnimationFrame(tick)
      if (time - last < 40) return
      last = time
      draw(time)
    }

    const start = async (): Promise<void> => {
      await document.fonts.load(`${cell}px "Geist Mono Variable"`)
      if (stopped) return
      resize()
      if (reduce) draw(4000)
      else frame = requestAnimationFrame(tick)
    }

    void start()
    window.addEventListener("resize", resize)
    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", resize)
    }
  }, [cell, speed, strength])

  return <canvas ref={canvas} className="pointer-events-none fixed inset-0 z-0 block h-dvh w-dvw" aria-hidden="true" />
}
