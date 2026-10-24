import { ChildProcess, spawn } from "node:child_process"
import { createWriteStream, WriteStream } from "node:fs"

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

export async function startServer(
  root: string,
  logPath: string,
  onStatus?: (text: string) => void
): Promise<"reused" | "started"> {
  if (await isUp()) return "reused"

  log = createWriteStream(logPath, { flags: "a" })
  child = spawn("uv", ["run", "src/miles/main.py"], {
    cwd: root,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"]
  })

  const onData = (data: Buffer) => {
    log?.write(data)
    tail.push(...data.toString().split("\n").filter(Boolean))
    if (tail.length > 200) tail.splice(0, tail.length - 200)
  }
  child.stdout?.on("data", onData)
  child.stderr?.on("data", onData)

  let exited = false
  child.once("exit", () => {
    exited = true
    child = null
  })

  const began = Date.now()
  while (Date.now() - began < MAX_WAIT_MS) {
    if (await isUp()) return "started"
    if (exited) throw new Error("The server stopped while starting.")
    const seconds = Math.round((Date.now() - began) / 1000)
    const last = tail.length ? `\n${tail[tail.length - 1].slice(0, 90)}` : ""
    onStatus?.(`Starting Miles… ${seconds}s${last}`)
    await sleep(1000)
  }
  throw new Error("The server did not become ready in 15 minutes.")
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
