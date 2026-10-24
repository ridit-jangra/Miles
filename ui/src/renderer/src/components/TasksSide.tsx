import { sampleTasks } from "../lib/sample"
import { ScrollArea } from "./ScrollArea"
import { Badge, Meter, VALUE } from "./ui"

export function TasksSide(): React.JSX.Element {
  return (
    <aside className="fixed top-0 right-0 z-10 w-[260px] h-screen max-[1000px]:hidden">
        <section className={"relative flex flex-col overflow-hidden border border-line bg-panel text-ink backdrop-blur-xl border-t-0 border-r-0 h-full"}>
          <header className="flex items-center gap-3 border-b border-edge px-4 py-3.5">
            <h2 className="m-0 font-display text-[27px] leading-none font-semibold">tasks</h2>
            <span className="ml-auto font-mono text-note text-ink-dim">example</span>
          </header>
          <div className="min-h-0 flex-1 p-4">
            <ScrollArea className="h-full">
        {sampleTasks.map((task) => (
            <div key={task.id} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <span className="text-[15px] leading-snug text-ink">{task.text}</span>
                <Badge tone={task.status === "done" ? "ok" : "plain"}>{task.status}</Badge>
              </div>
              <div className="flex items-center justify-between font-mono text-note text-ink-dim">
                <span>{task.agent}</span>
                <span className={VALUE}>{task.took}</span>
              </div>
              {task.status === "running" && <Meter value={0.38} />}
            </div>
            ))}
            </ScrollArea>
          </div>
        </section>
    </aside>
  )
}
