import { Badge, Btn, Note, PageTitle, Panel, Row } from "../components/ui"
import { api } from "../lib/api"
import { ago, usePoll } from "../lib/poll"

type Alert = { id: number; source: string; text: string; priority: string; age: number }

export function Inbox(): React.JSX.Element {
  const [alerts, refresh] = usePoll<Alert[]>("/inbox", 3000, [])

  const markRead = async (alert: Alert): Promise<void> => {
    await api.post(`/inbox/${alert.id}/read`)
    refresh()
  }

  return (
    <>
      <PageTitle>inbox</PageTitle>
      <Panel title="alerts" note={alerts.length === 0 ? "all caught up" : `${alerts.length} unread`}>
        {alerts.length === 0 && <Note>nothing new. alerts from your plugins show up here and miles tells you about them.</Note>}
        {alerts.map((alert) => (
          <Row
            key={alert.id}
            label={alert.text}
            hint={`${alert.source} · ${ago(alert.age)} ago`}
            value={
              <span className="inline-flex items-center gap-3">
                <Badge tone={alert.priority === "urgent" ? "bad" : "plain"}>{alert.priority}</Badge>
                <Btn variant="ghost" small onClick={() => void markRead(alert)}>
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
