import { Badge, Meter, PageTitle, Panel, Row, VALUE } from "../components/ui"
import { sampleTasks } from "../lib/sample"

export function Tasks(): React.JSX.Element {
  return (
    <>
      <PageTitle>tasks</PageTitle>
      <Panel title="background agents" note="example data">
        {sampleTasks.map((task) => (
          <div key={task.id} className="flex flex-col gap-3">
            <Row
              num={task.id}
              label={task.text}
              hint={`${task.agent} agent`}
              value={
                <span className="inline-flex items-center gap-3">
                  <span className={VALUE}>{task.took}</span>
                  <Badge tone={task.status === "done" ? "ok" : "plain"}>{task.status}</Badge>
                </span>
              }
            />
            {task.status === "running" && <Meter value={0.38} />}
          </div>
        ))}
      </Panel>
    </>
  )
}
