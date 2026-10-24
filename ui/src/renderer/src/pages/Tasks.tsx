import { useState } from "react"

import { TaskDialog } from "../components/TaskDialog"
import { Badge, Btn, Note, PageTitle, Panel, Row, VALUE } from "../components/ui"
import { cancelTask, clock, TONE, useTasks } from "../lib/tasks"

export function Tasks(): React.JSX.Element {
  const tasks = useTasks()
  const [openId, setOpenId] = useState<string | null>(null)
  const open = tasks.find((task) => task.id === openId) ?? null

  return (
    <>
      <PageTitle>tasks</PageTitle>
      <Panel title="background agents" note={`${tasks.length} this session`}>
        {tasks.length === 0 && <Note>nothing running. ask miles to look something up and it shows here.</Note>}
        {tasks.map((task) => {
          const detail = task.status === "failed" ? task.error : task.result
          return (
            <div
              key={task.id}
              role="button"
              tabIndex={0}
              className="flex cursor-pointer flex-col gap-2 outline-none"
              onClick={() => setOpenId(task.id)}
              onKeyDown={(event) => event.key === "Enter" && setOpenId(task.id)}
            >
              <Row
                num={task.id}
                label={task.text}
                hint={`${task.agent} agent`}
                value={
                  <span className="inline-flex items-center gap-3">
                    <span className={VALUE}>{clock(task.took)}</span>
                    <Badge tone={TONE[task.status]}>{task.status}</Badge>
                    {task.status === "running" && (
                      <span onClick={(event) => event.stopPropagation()}>
                        <Btn variant="ghost" small onClick={() => void cancelTask(task.id)}>
                          cancel
                        </Btn>
                      </span>
                    )}
                  </span>
                }
              />
              {detail && <p className="m-0 line-clamp-2 px-[13px] text-note text-ink-dim">{detail}</p>}
            </div>
          )
        })}
      </Panel>
      <TaskDialog task={open} onClose={() => setOpenId(null)} />
    </>
  )
}
