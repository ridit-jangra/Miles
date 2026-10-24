import { useEffect, useState } from "react"

import { api } from "./api"

export type Task = {
  id: string
  agent: string
  text: string
  status: "running" | "done" | "failed" | "cancelled"
  took: number
  result: string | null
  error: string | null
}

export const TONE = { running: "plain", done: "ok", failed: "bad", cancelled: "plain" } as const

export const clock = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`

export function useTasks(): Task[] {
  const [tasks, setTasks] = useState<Task[]>([])

  useEffect(() => {
    const load = (): void => {
      api.get<Task[]>("/tasks").then(setTasks).catch(() => {})
    }
    load()
    const timer = setInterval(load, 2000)
    return () => clearInterval(timer)
  }, [])

  return tasks
}

export const cancelTask = (id: string): Promise<Response> => api.del(`/tasks/${id}`)
