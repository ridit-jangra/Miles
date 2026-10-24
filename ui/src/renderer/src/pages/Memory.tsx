import { useEffect, useState } from "react"

import { Btn, Note, PageTitle, Panel, Row } from "../components/ui"
import { api, Fact } from "../lib/api"

export function Memory(): React.JSX.Element {
  const [facts, setFacts] = useState<Fact[]>([])
  const [asking, setAsking] = useState<string | null>(null)
  useEffect(() => {
    const load = (): void => {
      api.get<Fact[]>("/memory/facts").then(setFacts).catch(() => {})
    }
    load()
    const timer = setInterval(load, 3000)
    return () => clearInterval(timer)
  }, [])

  const forget = async (fact: Fact) => {
    await api.del(`/memory/facts?id=${encodeURIComponent(fact.id)}`)
    setFacts((c) => c.filter((f) => f.id !== fact.id))
    setAsking(null)
  }

  return (
    <>
      <PageTitle>memory</PageTitle>
      <Panel title="what miles knows" note={`${facts.length} facts`}>
        {facts.length === 0 && <Note>nothing saved yet. say "remember that..." and it lands here.</Note>}
        {facts.map((fact) => (
          <Row
            key={fact.id}
            label={fact.text}
            value={
              asking === fact.id ? (
                <span className="flex items-center gap-2">
                  <span className="text-note text-ink-dim">forget this for good?</span>
                  <Btn variant="primary" small onClick={async () => await forget(fact)}>
                    yes
                  </Btn>
                  <Btn variant="ghost" small onClick={() => setAsking(null)}>
                    no
                  </Btn>
                </span>
              ) : (
                <Btn variant="ghost" small onClick={() => setAsking(fact.id)}>
                  forget
                </Btn>
              )
            }
          />
        ))}
      </Panel>
    </>
  )
}
