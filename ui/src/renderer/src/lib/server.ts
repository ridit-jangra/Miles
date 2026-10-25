import { useEffect, useState } from "react"

export type ServerStatus = {
  state: "starting" | "ready" | "error"
  text: string
  steps?: { id: string; label: string; state: "pending" | "active" | "done"; fraction: number }[]
  log?: string
  review?: { name: string; state: "new" | "changed"; description: string; permissions: string[]; dependencies: string[]; servers: { name: string; run: string }[] }[]
}

export function useServer(): ServerStatus {
  const [status, setStatus] = useState<ServerStatus>(
    window.miles ? { state: "starting", text: "Starting Miles…" } : { state: "ready", text: "" },
  )

  useEffect(() => {
    if (!window.miles) return
    void window.miles.serverStatus().then(setStatus)
    return window.miles.onServerStatus(setStatus)
  }, [])

  return status
}
