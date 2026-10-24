import { useState } from "react"

import { Badge, Btn, Note, PageTitle, Panel, Row } from "../components/ui"
import { sampleAlerts } from "../lib/sample"

export function Inbox(): React.JSX.Element {
  const [alerts, setAlerts] = useState(sampleAlerts)

  return (
    <>
      <PageTitle>inbox</PageTitle>
      <Panel title="alerts" note={alerts.length === 0 ? "all caught up" : `${alerts.length} unread · example data`}>
        {alerts.length === 0 && <Note>nothing new. alerts from your plugins show up here and miles tells you about them.</Note>}
        {alerts.map((alert) => (
          <Row
            key={alert.id}
            label={alert.text}
            hint={`${alert.source} · ${alert.when} ago`}
            value={
              <span className="inline-flex items-center gap-3">
                <Badge tone={alert.priority === "urgent" ? "bad" : "plain"}>{alert.priority}</Badge>
                <Btn variant="ghost" small onClick={() => setAlerts((c) => c.filter((a) => a.id !== alert.id))}>
                  mark read
                </Btn>
              </span>
            }
          />
        ))}
      </Panel>
    </>
  )
}
