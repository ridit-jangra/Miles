export {}

type ServerStatus = { state: "starting" | "ready" | "error"; text: string }

declare global {
  interface Window {
    miles?: {
      platform: string
      serverStatus: () => Promise<ServerStatus>
      onServerStatus: (callback: (status: ServerStatus) => void) => () => void
    }
  }
}
