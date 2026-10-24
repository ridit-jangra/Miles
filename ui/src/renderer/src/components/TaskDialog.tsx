import { useEffect } from "react"
import { createPortal } from "react-dom"

import { cancelTask, clock, TONE, type Task } from "../lib/tasks"
import { Badge, Btn, VALUE } from "./ui"

function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-note text-ink-dim">{title}</span>
      <div className="text-ui leading-[1.55] whitespace-pre-wrap text-ink">{children}</div>
    </div>
  )
}

export function TaskDialog({ task, onClose }: { task: Task | null; onClose: () => void }): React.JSX.Element | null {
  useEffect(() => {
    if (!task) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [task, onClose])

  if (!task) return null

  const failed = task.status === "failed"
  const outcome = failed ? task.error : task.result

  return createPortal(
    <div className="fixed inset-0 z-300 grid place-items-center bg-black/60 px-6" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`task ${task.id}`}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-control border border-line bg-[#121214] text-ink"
      >
        <header className="flex items-center gap-3 border-b border-edge px-4 py-3.5">
          <h2 className="m-0 font-display text-[27px] leading-none font-semibold">{task.id}</h2>
          <span className={VALUE}>{task.agent} agent</span>
          <span className="ml-auto inline-flex items-center gap-3">
            <span className={VALUE}>{clock(task.took)}</span>
            <Badge tone={TONE[task.status]}>{task.status}</Badge>
          </span>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
          <Section title="asked">{task.text}</Section>
          <Section title={failed ? "error" : "result"}>
            {outcome ?? (task.status === "running" ? "still working…" : "nothing returned")}
          </Section>
        </div>
        <footer className="flex justify-end gap-2.5 border-t border-edge px-4 py-3.5">
          {task.status === "running" && (
            <Btn variant="ghost" onClick={() => void cancelTask(task.id)}>
              cancel task
            </Btn>
          )}
          <Btn variant="primary" onClick={onClose}>
            close
          </Btn>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
