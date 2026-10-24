import { useState } from "react"

import { clock, TONE, useTasks } from "../lib/tasks"
import { TaskDialog } from "./TaskDialog"
import { ScrollArea } from "./ScrollArea"
import { Badge, VALUE } from "./ui"

export function TasksSide(): React.JSX.Element {
  const tasks = useTasks()
  const [openId, setOpenId] = useState<string | null>(null)
  const open = tasks.find((task) => task.id === openId) ?? null
  return (
    <aside className="fixed top-0 right-0 z-10 w-[260px] h-screen max-[1000px]:hidden">
        <section className={"relative flex flex-col overflow-hidden border border-line bg-panel text-ink backdrop-blur-xl border-t-0 border-r-0 h-full"}>
          <header className="flex items-center gap-3 border-b border-edge px-4 py-3.5">
            <h2 className="m-0 font-display text-[27px] leading-none font-semibold">tasks</h2>
            <span className="ml-auto font-mono text-note text-ink-dim">{tasks.length}</span>
          </header>
          <div className="min-h-0 flex-1 p-4">
            <ScrollArea className="h-full">
        {tasks.map((task) => (
            <div
              key={task.id}
              role="button"
              tabIndex={0}
              className="flex cursor-pointer flex-col gap-2 outline-none"
              onClick={() => setOpenId(task.id)}
              onKeyDown={(event) => event.key === "Enter" && setOpenId(task.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="line-clamp-3 text-[15px] leading-snug text-ink">{task.text}</span>
                <Badge tone={TONE[task.status]}>{task.status}</Badge>
              </div>
              <div className="flex items-center justify-between font-mono text-note text-ink-dim">
                <span>{task.agent}</span>
                <span className={VALUE}>{clock(task.took)}</span>
              </div>
            </div>
            ))}
            </ScrollArea>
          </div>
        </section>
      <TaskDialog task={open} onClose={() => setOpenId(null)} />
    </aside>
  )
}
