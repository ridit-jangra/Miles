export {}

type ServerStatus = {
  state: "starting" | "ready" | "error"
  text: string
  steps?: { id: string; label: string; state: "pending" | "active" | "done"; fraction: number }[]
  log?: string
}

declare global {
  interface Window {
    miles?: {
      platform: string
      serverStatus: () => Promise<ServerStatus>
      onServerStatus: (callback: (status: ServerStatus) => void) => () => void
    }
  }
}
