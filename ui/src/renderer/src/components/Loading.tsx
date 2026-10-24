import { cn } from "../lib/cn"
import type { ServerStatus } from "../lib/server"
import { AsciiField } from "./AsciiField"
import { PageTitle } from "./ui"

type Step = NonNullable<ServerStatus["steps"]>[number]

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

export function Loading({ status }: { status: ServerStatus }): React.JSX.Element {
  const failed = status.state === "error"

  return (
    <>
      <AsciiField />
      <div className="fixed inset-0 z-1000 flex flex-col items-center justify-center gap-10 px-6 text-center">
        <PageTitle>{status.state === "starting" ? "Starting background server" : status.state === "ready" ? "Starting client" : "Failed to start server"}</PageTitle>
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
        {!failed && status.log && (
          <p className="absolute inset-x-0 bottom-8 m-0 truncate px-6 font-mono text-note text-ink-dim opacity-60">
            {status.log}
          </p>
        )}
      </div>
    </>
  )
}
