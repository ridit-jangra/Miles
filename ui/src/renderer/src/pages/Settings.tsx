import { useEffect, useState } from "react"

import { Note, PageTitle, Panel, Row, Switch } from "../components/ui"
import { api } from "../lib/api"

export function Settings(): React.JSX.Element {
  const [auto, setAuto] = useState<boolean | null>(null)

  useEffect(() => {
    api.get<{ auto_confirm: boolean }>("/settings").then((s) => setAuto(s.auto_confirm)).catch(() => {})
  }, [])

  const change = (on: boolean): void => {
    setAuto(on)
    api.post(`/settings/auto-confirm?on=${on}`).catch(() => setAuto(!on))
  }

  return (
    <>
      <PageTitle>settings</PageTitle>
      <Panel title="actions">
        <Row
          label="auto mode"
          hint="Miles does what you ask without checking first, like sending a Slack message or moving a file to the trash."
          value={auto !== null && <Switch on={auto} onChange={change} label="auto mode" />}
        />
        {auto && <Note>Auto mode is on. Everything that used to ask now runs straight away, including forgetting a saved memory.</Note>}
      </Panel>
    </>
  )
}
