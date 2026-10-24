import { useState } from "react"

import { Btn, Note, PageTitle, Panel, Row } from "../components/ui"
import { sampleFacts } from "../lib/sample"

export function Memory(): React.JSX.Element {
  const [facts, setFacts] = useState(sampleFacts)

  return (
    <>
      <PageTitle>memory</PageTitle>
      <Panel title="what miles knows" note={`${facts.length} facts · example data`}>
        {facts.length === 0 && <Note>nothing saved yet. say "remember that..." and it lands here.</Note>}
        {facts.map((fact) => (
          <Row
            key={fact}
            label={fact}
            value={
              <Btn variant="ghost" small onClick={() => setFacts((c) => c.filter((f) => f !== fact))}>
                forget
              </Btn>
            }
          />
        ))}
      </Panel>
    </>
  )
}
