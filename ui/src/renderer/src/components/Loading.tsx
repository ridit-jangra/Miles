import { useState } from "react"

import { cn } from "../lib/cn"
import type { ServerStatus } from "../lib/server"
import { AsciiField } from "./AsciiField"
import { ScrollArea } from "./ScrollArea"
import { Badge, Btn, PageTitle } from "./ui"

type Step = NonNullable<ServerStatus["steps"]>[number]
type ReviewItem = NonNullable<ServerStatus["review"]>[number]

const MARK = { pending: "[ ]", active: "[~]", done: "[x]" }

function StepRow({ step }: { step: Step }): React.JSX.Element {
  const known = step.state === "active" && step.fraction >= 0
  return (
    <li className={cn("flex flex-col gap-1.5", step.state === "pending" && "opacity-50")}>
      <div className="flex items-baseline gap-3">
        <span className={cn("w-8 text-left", step.state === "active" && "animate-pulse")}>{MARK[step.state]}</span>
        <span className="flex-1 text-left">{step.label}</span>
        {known && <span>{Math.round(step.fraction * 100)}%</span>}
      </div>
      {known && (
        <div className="ml-11 h-1 overflow-hidden rounded-control bg-panel">
          <div
            className="h-full bg-ink transition-[width] duration-200"
            style={{ width: `${Math.round(step.fraction * 100)}%` }}
          />
        </div>
      )}
    </li>
  )
}

function Detail({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <span className="font-mono text-note break-all text-ink-dim [font-variant-ligatures:none]">
      <span className="text-ink-mid">{label}</span> {value}
    </span>
  )
}

function Review({ plugins }: { plugins: ReviewItem[] }): React.JSX.Element {
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const everything = picked.size === plugins.length

  const toggle = (name: string): void =>
    setPicked((current) => {
      const next = new Set(current)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  const send = (approve: string[]): void => void window.miles?.review({ approve })

  return (
    <div className="flex w-full flex-col gap-4 text-left">
      <div className="flex items-center justify-between gap-4 font-mono text-note text-ink-dim">
        <span>
          {plugins.length} new or changed plugin{plugins.length === 1 ? "" : "s"}. Pick what Miles may install and run.
        </span>
        <button
          type="button"
          onClick={() => setPicked(everything ? new Set() : new Set(plugins.map((p) => p.name)))}
          className="cursor-pointer whitespace-nowrap outline-none hover:text-ink hover:underline focus-visible:text-ink focus-visible:underline"
        >
          {everything ? "select none" : "select all"}
        </button>
      </div>
      <ScrollArea className="max-h-[42vh]">
        {plugins.map((plugin) => {
          const on = picked.has(plugin.name)
          return (
            <label
              key={plugin.name}
              className={cn(
                "flex cursor-pointer gap-3 rounded-control border p-3 transition-colors duration-120",
                on ? "border-edge bg-surface" : "border-line bg-panel hover:bg-surface",
              )}
            >
              <input type="checkbox" checked={on} onChange={() => toggle(plugin.name)} className="peer sr-only" />
              <span className="font-mono text-ui text-ink-dim peer-focus-visible:text-ink">{on ? "[x]" : "[ ]"}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-ui text-ink">{plugin.name}</span>
                  {plugin.state === "changed" && <Badge tone="warn">changed</Badge>}
                </div>
                {plugin.description && <span className="text-note text-ink-dim">{plugin.description}</span>}
                {plugin.dependencies.length > 0 && <Detail label="installs" value={plugin.dependencies.join(", ")} />}
                {plugin.servers.map((server) => (
                  <Detail key={server.name} label="runs" value={server.run} />
                ))}
                {plugin.permissions.length > 0 && <Detail label="wants" value={plugin.permissions.join(", ")} />}
              </div>
            </label>
          )
        })}
      </ScrollArea>
      <div className="flex justify-end gap-2.5">
        <Btn variant="ghost" onClick={() => send([])}>
          skip all
        </Btn>
        <Btn variant="primary" disabled={picked.size === 0} onClick={() => send([...picked])}>
          {picked.size ? `install ${picked.size} selected` : "install selected"}
        </Btn>
      </div>
    </div>
  )
}

export function Loading({ status }: { status: ServerStatus }): React.JSX.Element {
  const failed = status.state === "error"

  return (
    <>
      <AsciiField />
      <div className="fixed inset-0 z-1000 flex flex-col items-center justify-center gap-10 px-6 text-center">
        <PageTitle>{status.review?.length ? "New plugins found" : status.state === "starting" ? "Starting background server" : status.state === "ready" ? "Starting client" : "Failed to start server"}</PageTitle>
        {status.review?.length ? (
          <div className="w-full max-w-xl">
            <Review key={status.review.map((p) => p.name).join()} plugins={status.review} />
          </div>
        ) : (
        <div className="flex w-full max-w-sm flex-col gap-4">
          {status.steps && (
            <ul className="m-0 flex list-none flex-col gap-3 p-0 font-mono text-ui text-ink-dim">
              {status.steps.map((step) => (
                <StepRow key={step.id} step={step} />
              ))}
            </ul>
          )}
          {(failed || status.text) && (
            <p className="m-0 text-ui leading-[1.55] text-ink-dim font-mono">
              {failed ? "Miles could not start" : status.text}
            </p>
          )}
          {failed && (
            <pre className="whitespace-pre-wrap text-left text-xs text-ink-dim font-mono">{status.text}</pre>
          )}
        </div>
        )}
        {!failed && status.log && (
          <p className="absolute inset-x-0 bottom-8 m-0 truncate px-6 font-mono text-note text-ink-dim opacity-60">
            {status.log}
          </p>
        )}
      </div>
    </>
  )
}
