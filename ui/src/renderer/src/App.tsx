import { Loading } from "./components/Loading"
import { Workspace } from "./components/Workspace"
import { useServer } from "./lib/server"
import { VoiceProvider } from "./lib/voice"
import { WorkspaceProvider } from "./lib/workspace"
import { AsciiField } from "./components/AsciiField"

function Shell(): React.JSX.Element {
  return (
    <div className="relative z-200 flex h-dvh flex-col overflow-hidden font-sans">
      <main className="relative min-h-0 flex-1 p-2">
        <Workspace />
      </main>
    </div>
  )
}

export default function App(): React.JSX.Element {
  const server = useServer()

  return (
    <>
      {server.state === "ready" ? (
        <VoiceProvider>
          <WorkspaceProvider>
            <Shell />
          </WorkspaceProvider>
        </VoiceProvider>
      ) : (
        <>
          <AsciiField />
          <Loading status={server} />
        </>
      )}
    </>
  )
}
