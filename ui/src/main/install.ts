import { spawn } from "node:child_process";
import { accessSync, constants, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";

import { toolEnv } from "./paths";
import { ANSI, type ReviewItem } from "./server";

const DRY = !!process.env.MILES_INSTALL_DRY_RUN

export function run(cmd: string, args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv; stdin?: string; onLine?: (line: string) => void }): Promise<number> {
  if (DRY) { opts.onLine?.(`[dry run] ${cmd} ${args.join(" ")}`); return Promise.resolve(0) }
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, env: opts.env ?? toolEnv(), stdio: ["pipe", "pipe", "pipe"] })
    const feed = (stream: NodeJS.ReadableStream) => {
      let partial = ""
      stream.on("data", (d: Buffer) => {
        const parts = (partial + d.toString()).replace(ANSI, "").split(/[\r\n]/)
        partial = parts.pop() ?? ""
        parts.filter(Boolean).forEach((l) => opts.onLine?.(l))
      })
    }
    feed(child.stdout); feed(child.stderr)
    child.on("error", reject)                       // command not found
    child.on("close", (code: number | null) => resolve(code ?? 1))
    if (opts.stdin) child.stdin.write(opts.stdin)
    child.stdin.end()
  })
}


export function has(cmd: string, env = toolEnv()): boolean {
  return (env.PATH ?? "").split(delimiter).some((dir) => {
    try { accessSync(join(dir, cmd), constants.X_OK); return true } catch { return false }
  })
}

export function packageCommand(packages: string[]): string[] | null {
  const info = readFileSync("/etc/os-release", "utf8")
  const family = `${/^ID=(.*)$/m.exec(info)?.[1] ?? ""} ${/^ID_LIKE=(.*)$/m.exec(info)?.[1] ?? ""}`
  if (/arch/.test(family)) return ["pacman", "-S", "--needed", "--noconfirm", ...packages]
  if (/debian|ubuntu/.test(family)) return ["sh", "-c", `apt-get update && apt-get install -y ${packages.join(" ")}`]
  if (/fedora|rhel/.test(family)) return ["dnf", "install", "-y", ...packages]
  return null
}

export type InstallUI = {
  step(id: string, label: string, state: "pending" | "active" | "done", fraction?: number): void
  log(line: string): void
  ask(items: ReviewItem[]): Promise<string[]>
}

export type Tool = {
  name: string
  required: boolean
  description: string
  note?: string
  packages?: string[]
  script?: string
}

export const TOOLS: Tool[] = [
  { name: "git", required: true, description: "Downloads Miles.", packages: ["git"] },
  { name: "uv", required: true, description: "Sets up Miles's Python environment.", script: "https://astral.sh/uv/install.sh" },
  { name: "bun", required: false, description: "Only needed by plugins that start servers with bunx.", script: "https://bun.sh/install", note: "may add itself to your shell profile" },
  { name: "node", required: false, description: "Only needed for the browser plugin.", packages: ["nodejs", "npm"] },
]

export const missingTools = (env = toolEnv()): Tool[] => TOOLS.filter((tool) => !has(tool.name, env))

export function installCommand(tool: Tool): { text: string; needsPassword: boolean } | null {
  if (tool.script) return { text: `download ${tool.script} and run it with sh`, needsPassword: false }
  const command = packageCommand(tool.packages ?? [])
  return command ? { text: `pkexec ${command.join(" ")}`, needsPassword: true } : null
}

export function reviewItems(missing: Tool[]): ReviewItem[] {
  return missing.map((tool) => {
    const how = installCommand(tool)
    return {
      name: tool.name,
      state: "new",
      selected: tool.required,
      description: `${tool.required ? "Required. " : "Optional. "}${tool.description}${tool.note ? ` It ${tool.note}.` : ""}`,
      permissions: how?.needsPassword ? ["your password"] : [],
      dependencies: [],
      servers: [{ name: tool.name, run: how ? how.text : `install ${tool.name} yourself, your system wasn't recognised` }],
    }
  })
}

const REPO = "https://github.com/ridit-jangra/miles"

export const installed = (root: string): boolean =>
  existsSync(join(root, "src", "miles", "main.py")) && existsSync(join(root, ".venv"))

async function installTool(tool: Tool, ui: InstallUI): Promise<void> {
  const label = `Installing ${tool.name}`
  ui.step(`tool-${tool.name}`, label, "active", -1)
  if (tool.script) {
    let script = ""
    if (!DRY) {
      const response = await fetch(tool.script)
      if (!response.ok) throw new Error(`Couldn't download the ${tool.name} installer (${response.status}).`)
      script = await response.text()
    }
    const code = await run("sh", ["-s"], { stdin: script, env: { ...toolEnv(), UV_NO_MODIFY_PATH: "1" }, onLine: (l) => ui.log(l) })
    if (code !== 0) throw new Error(`The ${tool.name} installer failed.`)
  } else {
    const command = packageCommand(tool.packages ?? [])
    if (!command) throw new Error(`I don't know how to install ${tool.name} on this system. Install it yourself and start Miles again.`)
    let code: number
    try {
      code = await run("pkexec", command, { onLine: (l) => ui.log(l) })
    } catch {
      throw new Error(`pkexec isn't available. Run this yourself, then start Miles again: sudo ${command.join(" ")}`)
    }
    if (code !== 0) throw new Error(`Installing ${tool.name} failed or was cancelled. You can run it yourself: sudo ${command.join(" ")}`)
  }
  if (!DRY && !has(tool.name)) throw new Error(`${tool.name} is still missing after installing it.`)
  ui.step(`tool-${tool.name}`, label, "done", 1)
}

async function clone(root: string, version: string, ui: InstallUI): Promise<void> {
  const label = "Downloading Miles"
  if (existsSync(join(root, "src", "miles", "main.py"))) return ui.step("clone", label, "done", 1)
  const existed = existsSync(root)
  const onLine = (line: string): void => {
    const match = /Receiving objects:\s+(\d+)%/.exec(line)
    if (match) ui.step("clone", label, "active", Number(match[1]) / 100)
    else ui.log(line)
  }
  ui.step("clone", label, "active", 0)
  mkdirSync(dirname(root), { recursive: true })
  const base = ["clone", "--depth", "1", "--progress"]
  let code = await run("git", [...base, "--branch", `v${version}`, REPO, root], { onLine })
  if (code !== 0) {
    if (!existed) rmSync(root, { recursive: true, force: true })
    code = await run("git", [...base, REPO, root], { onLine })
  }
  if (code !== 0) {
    if (!existed) rmSync(root, { recursive: true, force: true })
    throw new Error("Couldn't download Miles. Check your internet connection and try again.")
  }
  ui.step("clone", label, "done", 1)
}

async function sync(root: string, ui: InstallUI): Promise<void> {
  const label = "Setting up Python"
  ui.step("sync", label, "active", -1)
  const code = await run("uv", ["sync"], { cwd: root, onLine: (l) => ui.log(l) })
  if (code !== 0) throw new Error("Setting up Python failed. The last lines of the log say why.")
  ui.step("sync", label, "done", 1)
}

export async function ensureInstalled(ui: InstallUI, root: string, version: string): Promise<void> {
  if (installed(root)) return
  const notMiles = !existsSync(join(root, "src", "miles", "main.py")) && existsSync(root) && readdirSync(root).length > 0
  if (notMiles) throw new Error(`${root} already exists and isn't a Miles install. Move it away and try again.`)
  const missing = missingTools()
  const approved = missing.length ? await ui.ask(reviewItems(missing)) : []
  const refused = missing.filter((tool) => tool.required && !approved.includes(tool.name))
  if (refused.length) throw new Error(`Miles can't be installed without ${refused.map((t) => t.name).join(" and ")}.`)
  const toInstall = missing.filter((tool) => approved.includes(tool.name))
  for (const tool of toInstall) ui.step(`tool-${tool.name}`, `Installing ${tool.name}`, "pending")
  ui.step("clone", "Downloading Miles", "pending")
  ui.step("sync", "Setting up Python", "pending")
  for (const tool of toInstall) await installTool(tool, ui)
  await clone(root, version, ui)
  await sync(root, ui)
}
