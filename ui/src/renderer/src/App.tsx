import { useState } from "react"

import { Dock } from "./components/Dock"
import { Stage } from "./components/Stage"
import { TasksSide } from "./components/TasksSide"
import { type Page } from "./components/Nav"
import { Inbox } from "./pages/Inbox"
import { Memory } from "./pages/Memory"
import { Plugins } from "./pages/Plugins"
import { Tasks } from "./pages/Tasks"
import { Loading } from "./components/Loading"
import { useServer } from "./lib/server"
import { useVoice, VoiceProvider } from "./lib/voice"
import { AsciiField } from "./components/AsciiField"

function Shell(): React.JSX.Element {
  const [page, setPage] = useState<Page>("home")
  const voice = useVoice()

  return (
    <>
      <AsciiField />
      <div className="relative z-200 flex min-h-dvh flex-col font-sans">
        {page === "home" && (
          <>
            <Stage />
            <TasksSide />
          </>
        )}
        <Dock page={page} onPage={setPage} live={voice.status === "live"} />
        <main className="mx-auto flex h-dvh min-h-0 w-full max-w-[880px] flex-1 flex-col gap-6 px-6 py-8 max-[720px]:px-4">
          {page === "inbox" && <Inbox />}
          {page === "tasks" && <Tasks />}
          {page === "plugins" && <Plugins />}
          {page === "memory" && <Memory />}
        </main>
        </div>
    </>
  )
}

export default function App(): React.JSX.Element {
  const server = useServer()

  return (
    <>
      {server.state === "ready" ? (
        <VoiceProvider>
          <Shell />
        </VoiceProvider>
      ) : (
        <Loading status={server} />
      )}
    </>
  )
}
