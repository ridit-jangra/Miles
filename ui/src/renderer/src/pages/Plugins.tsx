import { Badge, Note, PageTitle, Panel, Row } from "../components/ui"
import { usePoll } from "../lib/poll"

type Plugin = { name: string; hint: string; state: "ready" | "missing" | "off" }

const TONE = { ready: "ok", missing: "warn", off: "plain" } as const
const LABEL = { ready: "ready", missing: "not installed", off: "disabled" } as const

export function Plugins(): React.JSX.Element {
  const [plugins] = usePoll<Plugin[]>("/plugins", 10000, [])

  return (
    <>
      <PageTitle>plugins</PageTitle>
      <Panel title="installed" note={`${plugins.length} found`}>
        {plugins.length === 0 && <Note>no plugins found in the plugins folder.</Note>}
        {plugins.map((plugin) => (
          <Row
            key={plugin.name}
            label={plugin.name}
            hint={plugin.hint}
            value={<Badge tone={TONE[plugin.state]}>{LABEL[plugin.state]}</Badge>}
          />
        ))}
      </Panel>
    </>
  )
}
