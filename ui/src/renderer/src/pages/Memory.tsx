import { useEffect, useState } from "react"

import { Btn, Note, PageTitle, Panel, Row } from "../components/ui"
import { api, Fact } from "../lib/api"

export function Memory(): React.JSX.Element {
  const [facts, setFacts] = useState<Fact[]>([])
  const [asking, setAsking] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState("")
  const [problem, setProblem] = useState<string | null>(null)
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

  const closeAdd = (): void => {
    setAdding(false)
    setDraft("")
    setProblem(null)
  }

  const add = async (): Promise<void> => {
    if (!draft.trim()) return
    try {
      const { result } = (await (await api.post("/memory/facts", { text: draft })).json()) as { result: string }
      if (result === "saved") {
        setFacts(await api.get<Fact[]>("/memory/facts"))
        closeAdd()
      } else {
        setProblem(result === "duplicate" ? "miles already knows that" : result.replace("rejected: ", ""))
      }
    } catch {
      setProblem("could not reach the server")
    }
  }

  const foot = adding ? (
    <form
      className="flex w-full flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        void add()
      }}
    >
      <div className="flex gap-2">
        <input
          autoFocus
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setProblem(null)
          }}
          onKeyDown={(e) => e.key === "Escape" && closeAdd()}
          placeholder="something miles should know"
          className="min-w-0 flex-1 rounded-control border border-edge bg-lift px-3 py-2 font-display text-ui text-ink outline-none transition-colors duration-120 placeholder:text-ink-dim focus-visible:border-ink"
        />
        <Btn variant="primary" small disabled={!draft.trim()} onClick={() => void add()}>
          save
        </Btn>
        <Btn variant="ghost" small onClick={closeAdd}>
          cancel
        </Btn>
      </div>
      {problem && <p className="m-0 text-note text-ink-dim">{problem}</p>}
    </form>
  ) : (
    <Btn variant="primary" small onClick={() => setAdding(true)}>
      add fact
    </Btn>
  )

  return (
    <>
      <PageTitle>memory</PageTitle>
      <Panel title="what miles knows" note={`${facts.length} facts`} foot={foot}>
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
