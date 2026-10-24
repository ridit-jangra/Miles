import { Badge, PageTitle, Panel, Row } from "../components/ui"
import { samplePlugins } from "../lib/sample"

export function Plugins(): React.JSX.Element {
  return (
    <>
      <PageTitle>plugins</PageTitle>
      <Panel title="installed" note={`${samplePlugins.length} found · example data`}>
        {samplePlugins.map((plugin) => (
          <Row
            key={plugin.name}
            label={plugin.name}
            hint={plugin.hint}
            value={<Badge tone={plugin.state === "ready" ? "ok" : "warn"}>{plugin.state === "ready" ? "ready" : "not installed"}</Badge>}
          />
        ))}
      </Panel>
    </>
  )
}
