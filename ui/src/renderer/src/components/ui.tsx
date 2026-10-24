import { ArrowRight, Check, Mic, MicOff, Power } from "lucide-react"

import { ScrollArea } from "./ScrollArea"
import { cn } from "../lib/cn"

export const VALUE = "font-mono text-note tabular-nums whitespace-nowrap text-ink-dim"

export function PageTitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <h1 className="m-0 font-display text-[clamp(40px,7vw,56px)] leading-[1.05] font-semibold text-fg">{children}</h1>
}

export function Dot({ on }: { on: boolean }): React.JSX.Element {
  return <span className={cn("inline-block size-[7px] rounded-full", on ? "bg-ink" : "bg-lift")} />
}

export function Note({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className="m-0 text-ui leading-[1.55] text-ink-dim">{children}</p>
}

export function Panel(props: {
  title: string
  note?: string
  children?: React.ReactNode
  foot?: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <section className={cn("relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-control border border-line bg-panel text-ink backdrop-blur-xl", props.className)}>
      <header className="flex items-center gap-3 border-b border-edge px-4 py-3.5">
        <h2 className="m-0 font-display text-[27px] leading-none font-semibold">{props.title}</h2>
        {props.note && <span className="ml-auto font-mono text-note text-ink-dim">{props.note}</span>}
      </header>
      {props.children && (
        <div className="min-h-0 flex-1 p-4">
          <ScrollArea className="h-full">{props.children}</ScrollArea>
        </div>
      )}
      {props.foot && <footer className="flex flex-wrap items-center gap-2.5 border-t border-edge px-4 py-3.5">{props.foot}</footer>}
    </section>
  )
}

const BADGE_TONES = {
  plain: "text-ink bg-lift  border-edge",
  done: "text-ink-mid bg-surface  border-edge",
  good: "text-on-light bg-ink  border-edge",
  bad: "text-[#f3ccd0] bg-[#3a1519] border-[#c2414c] ",
  ok: "text-[#cdf0d5] bg-[#16301e] border-[#3f9d57] ",
  warn: "text-[#f5e9b8] bg-[#33290f] border-[#c9a227] ",
} as const

export function Badge(props: { tone?: keyof typeof BADGE_TONES; children: React.ReactNode }): React.JSX.Element {
  return (
    <span className={cn("inline-grid place-items-center rounded-full border px-2.5 py-1 font-display text-note leading-none font-medium tracking-[0.02em] whitespace-nowrap", BADGE_TONES[props.tone ?? "plain"])}>
      {props.children}
    </span>
  )
}

export function Btn(props: {
  variant?: "primary" | "ghost"
  small?: boolean
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
}): React.JSX.Element {
  const hover = "hover:text-ink hover:bg-surface hover:border-edge  focus-visible:text-ink focus-visible:bg-surface focus-visible:border-edge "
  const variants = {
    primary: `border-ink text-on-light bg-ink  ${hover}`,
    ghost: "border-line text-ink bg-surface  hover:bg-panel hover:border-edge  focus-visible:bg-panel focus-visible:border-edge ",
  }
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      className={cn(
        "cursor-pointer rounded-control border text-center font-display text-ui leading-[1.4286] font-medium transition-colors duration-120 ease-[ease] outline-none disabled:cursor-default disabled:opacity-55",
        props.small ? "min-w-0 px-3 py-1.5 text-[15px]" : "min-w-[92px] px-[15px] py-[9px]",
        variants[props.variant ?? "primary"],
      )}
    >
      {props.children}
    </button>
  )
}

export function Meter(props: { value: number; cells?: number }): React.JSX.Element {
  const cells = props.cells ?? 48
  const on = Math.round(props.value * cells)
  return (
    <div
      className="grid h-[26px] auto-cols-fr grid-flow-col gap-0.5 rounded-md border border-line bg-[#17171a] p-[3px]"
      role="progressbar"
      aria-valuenow={Math.round(props.value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {Array.from({ length: cells }, (_, i) => (
        <i key={i} className={cn("block rounded-[1px]", i < on ? "bg-ink" : "bg-[#2b2b30]")} />
      ))}
    </div>
  )
}

const TILE = "relative flex min-h-[84px] flex-col justify-between gap-[18px] rounded-control border px-4 py-3.5 text-left"

export function StatTile(props: { figure: React.ReactNode; label: string }): React.JSX.Element {
  return (
    <div className={cn(TILE, "border-line bg-panel text-ink")}>
      <div className="flex items-center gap-2 font-mono text-[28px] leading-none tabular-nums">{props.figure}</div>
      <div className="text-note text-ink-dim">{props.label}</div>
    </div>
  )
}

export function ActionTile(props: { title: string; label: string; onClick: () => void; busy?: boolean }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.busy}
      className={cn(TILE, "group cursor-pointer border-ink bg-ink text-on-light  hover:border-edge hover:bg-surface hover:text-ink ")}
    >
      <ArrowRight className="absolute top-3.5 right-3.5" size={18} />
      <span className="font-display text-[30px] leading-none">{props.title}</span>
      <span className="text-note text-[#4a4742] group-hover:text-ink-dim">{props.label}</span>
    </button>
  )
}

export function Row(props: {
  num?: string
  label: React.ReactNode
  hint?: React.ReactNode
  value?: React.ReactNode
  done?: boolean
  current?: boolean
}): React.JSX.Element {
  return (
    <div
      className={cn(
        "grid w-full items-center gap-3 rounded-control border px-[13px] py-[11px] text-left text-ui leading-[1.4286] text-ink",
        props.num ? "grid-cols-[auto_minmax(0,1fr)_auto]" : "grid-cols-[minmax(0,1fr)_auto]",
        props.current ? "border-dashed border-edge bg-surface " : "border-transparent bg-transparent",
      )}
    >
      {props.num && <span className="self-start pt-1 font-mono text-xs text-ink-dim">{props.num}</span>}
      <span className={cn("min-w-0", props.done && "text-ink-mid")}>
        {props.label}
        {props.hint && <span className="mt-0.5 block text-note text-ink-dim">{props.hint}</span>}
      </span>
      <span className={cn(VALUE, "text-right")}>{props.value}</span>
    </div>
  )
}

export function DoneMark(): React.JSX.Element {
  return (
    <Badge tone="done">
      <Check size={13} />
    </Badge>
  )
}

export function VoiceControls(props: { live: boolean; muted: boolean; busy: boolean; onToggle: () => void; onMute: () => void }): React.JSX.Element {
  const seg = "inline-flex cursor-pointer items-center gap-2 bg-ink text-on-light font-display px-[15px] py-[9px] text-ui leading-[1.4286] font-medium outline-none transition-colors duration-120 disabled:cursor-default disabled:opacity-55"
  return (
    <div className="inline-flex overflow-hidden rounded-control border border-ink transition-colors duration-120 hover:border-edge focus-within:border-edge">
      {props.live && (
        <button type="button" onClick={props.onMute} className={cn(seg, "border-r border-on-light/25 hover:bg-surface hover:text-ink focus-visible:bg-surface focus-visible:text-ink")}>
          {props.muted ? <MicOff size={16} /> : <Mic size={16} />}
          {props.muted ? "unmute" : "mute"}
        </button>
      )}
      <button type="button" disabled={props.busy} onClick={props.onToggle} className={cn(seg, "hover:bg-surface hover:text-ink focus-visible:bg-surface focus-visible:text-ink")}>
        {props.live ? (
          <>
            <Power size={16} /> end
          </>
        ) : (
          "talk to miles"
        )}
      </button>
    </div>
  )
}
