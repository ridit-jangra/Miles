export {}

type ServerStatus = {
  state: "starting" | "ready" | "error"
  text: string
  steps?: { id: string; label: string; state: "pending" | "active" | "done"; fraction: number }[]
  log?: string
  title?: string
  intro?: string
  notice?: string
  form?: { fields: { name: string; label: string; provider: string; secret: boolean }[]; error: string | null }
  review?: { name: string; state: "new" | "changed"; description: string; permissions: string[]; dependencies: string[]; servers: { name: string; run: string }[]; selected?: boolean }[]
}

declare global {
  interface Window {
    miles?: {
      platform: string
      serverStatus: () => Promise<ServerStatus>
      review: (decision: { approve: string[] }) => Promise<void>
      acknowledge: () => Promise<void>
      answer: (values: Record<string, string> | null) => Promise<void>
      onServerStatus: (callback: (status: ServerStatus) => void) => () => void
    }
  }
}
