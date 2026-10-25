import { ChildProcess, spawn } from "node:child_process"
import { createWriteStream, WriteStream } from "node:fs"

import { toolEnv } from "./paths"

const READY_URL = "http://localhost:7860/client/"
const MAX_WAIT_MS = 15 * 60 * 1000

let child: ChildProcess | null = null
let log: WriteStream | null = null
const tail: string[] = []

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function isUp(): Promise<boolean> {
  try {
    const response = await fetch(READY_URL)
    return response.status < 500
  } catch {
    return false
  }
}

export function lastLogLines(count = 15): string {
  return tail.slice(-count).join("\n")
}

export type BootStep = {
  id: string
  label: string
  state: "pending" | "active" | "done"
  fraction: number
}

export type ReviewItem = {
  name: string
  state: "new" | "changed"
  description: string
  permissions: string[]
  dependencies: string[]
  servers: { name: string; run: string }[]
  selected?: boolean
}

export type FormRequest = { fields: { name: string; label: string; provider: string; secret: boolean }[]; error: string | null }

export type StatusUpdate = { text: string; steps?: BootStep[]; log?: string; review?: ReviewItem[]; form?: FormRequest }

export const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g
const TQDM = /\d+%\||it\/s\]|B\/s/

export async function startServer(
  root: string,
  logPath: string,
  onStatus?: (update: StatusUpdate) => void
): Promise<"reused" | "started"> {
  const steps = new Map<string, BootStep>()
  let review: ReviewItem[] | undefined
  let form: FormRequest | undefined
  if (await isUp()) return "reused"

  log = createWriteStream(logPath, { flags: "a" })
  child = spawn("uv", ["run", "src/miles/main.py"], {
    cwd: root,
    detached: process.platform !== "win32",
    env: { ...toolEnv(), MILES_EXIT_ON_STDIN_CLOSE: "1" },
    stdio: ["pipe", "pipe", "pipe"]
  })

  let booting = true
  const emit = (text = "") =>
    booting &&
    onStatus?.({ text, steps: steps.size ? [...steps.values()] : undefined, log: tail[tail.length - 1], review, form })

  const listen = (stream: NodeJS.ReadableStream | null) => {
    let partial = ""
    stream?.on("data", (data: Buffer) => {
      log?.write(data)
      const lines = (partial + data.toString()).replace(ANSI, "").split(/[\r\n]/)
      partial = lines.pop() ?? ""
      for (const line of lines.filter(Boolean)) {
        if (line.startsWith("MILES_STEP ")) {
          const [id, label, state, fraction] = line.slice(11).split("|")
          steps.set(id, { id, label, state: state as BootStep["state"], fraction: Number(fraction) })
          emit()
        } else if (line.startsWith("MILES_ASK ")) {
          try {
            form = JSON.parse(line.slice(10)) as FormRequest | undefined ?? undefined
            emit()
          } catch {}
        } else if (line.startsWith("MILES_REVIEW ")) {
          try {
            const items = JSON.parse(line.slice(13)) as ReviewItem[]
            review = items.length ? items : undefined
            emit()
          } catch {}
        } else if (!TQDM.test(line)) {
          tail.push(line)
        }
      }
      emit()
      if (tail.length > 200) tail.splice(0, tail.length - 200)
    })
  }
  listen(child.stdout)
  listen(child.stderr)

  let exited = false
  child.once("error", (error) => {
    tail.push(String(error))
    exited = true
    child = null
  })
  child.once("exit", () => {
    exited = true
    child = null
  })

  const began = Date.now()
  while (Date.now() - began < MAX_WAIT_MS) {
    if (await isUp()) {
      booting = false
      return "started"
    }
    if (exited) {
      booting = false
      throw new Error("The server stopped while starting.")
    }
    const seconds = Math.round((Date.now() - began) / 1000)
    if (steps.size === 0 && !review && !form) emit(`Starting Miles… ${seconds}s`)
    await sleep(1000)
  }
  booting = false
  throw new Error("The server did not become ready in 15 minutes.")
}

export function sendToServer(message: object): void {
  child?.stdin?.write(JSON.stringify(message) + "\n")
}

export async function stopServer(): Promise<void> {
  const proc = child
  if (!proc || proc.pid === undefined) return

  const gone = new Promise<void>((resolve) => proc.once("exit", () => resolve()))

  const signalGroup = (signal: NodeJS.Signals) => {
    try {
      process.kill(-proc.pid!, signal)
    } catch {}
  }

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(proc.pid), "/T", "/F"])
  } else {
    signalGroup("SIGINT")
    await Promise.race([gone, sleep(6000)])
    if (proc.exitCode === null) signalGroup("SIGKILL")
  }
  await gone
  log?.end()
}
