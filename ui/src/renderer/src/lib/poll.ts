import { useEffect, useState } from "react"

import { api } from "./api"

export function usePoll<T>(path: string, every: number, initial: T): [T, () => void] {
  const [data, setData] = useState<T>(initial)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const load = (): void => {
      api.get<T>(path).then(setData).catch(() => {})
    }
    load()
    const timer = setInterval(load, every)
    return () => clearInterval(timer)
  }, [path, every, tick])

  return [data, () => setTick((n) => n + 1)]
}

export const ago = (seconds: number): string =>
  seconds < 60 ? `${seconds}s` : seconds < 3600 ? `${Math.floor(seconds / 60)}m` : `${Math.floor(seconds / 3600)}h`
