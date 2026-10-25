import { spawn } from "node:child_process";
import { accessSync, constants, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";

import { milesHome, toolEnv } from "./paths";
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
  ask(items: ReviewItem[], intro?: string): Promise<string[]>
  notice(text: string): Promise<void>
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

const REPO = process.env.MILES_REPO_URL || "https://github.com/ridit-jangra/miles"
const PLUGINS_REPO = process.env.MILES_PLUGINS_REPO_URL || "https://github.com/ridit-jangra/miles-plugins"

export const pluginsDir = (): string => process.env.MILES_PLUGINS_DIR || join(milesHome(), "plugins")

const pluginsMissing = (): boolean => !existsSync(pluginsDir()) || readdirSync(pluginsDir()).length === 0

function pluginsItem(): ReviewItem {
  return {
    name: "plugins",
    state: "new",
    selected: true,
    description: "Optional. The official Miles plugins: weather, alarms, a browser, files and more. Each plugin still asks before it runs.",
    permissions: [],
    dependencies: [],
    servers: [{ name: "plugins", run: `git clone ${PLUGINS_REPO} ${pluginsDir()}` }],
  }
}

async function clonePlugins(ui: InstallUI): Promise<void> {
  const label = "Downloading plugins"
  const dir = pluginsDir()
  const existed = existsSync(dir)
  ui.step("plugins-pack", label, "active", 0)
  mkdirSync(dirname(dir), { recursive: true })
  const onLine = (line: string): void => {
    const match = /Receiving objects:\s+(\d+)%/.exec(line)
    if (match) ui.step("plugins-pack", label, "active", Number(match[1]) / 100)
    else ui.log(line)
  }
  const code = await run("git", ["clone", "--depth", "1", "--progress", PLUGINS_REPO, dir], { onLine }).catch(() => 1)
  if (code !== 0) {
    if (!existed) rmSync(dir, { recursive: true, force: true })
    throw new Error("Couldn't download the plugins.")
  }
  ui.step("plugins-pack", label, "done", 1)
}

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
  const offerPlugins = pluginsMissing()
  const items = [...reviewItems(missing), ...(offerPlugins ? [pluginsItem()] : [])]
  const intro = missing.length ? undefined : "Miles can also download its official plugins. Pick what you want."
  const approved = items.length ? await ui.ask(items, intro) : []
  const wantPlugins = offerPlugins && approved.includes("plugins")
  const refused = missing.filter((tool) => tool.required && !approved.includes(tool.name))
  if (refused.length) throw new Error(`Miles can't be installed without ${refused.map((t) => t.name).join(" and ")}.`)
  const toInstall = missing.filter((tool) => approved.includes(tool.name))
  for (const tool of toInstall) ui.step(`tool-${tool.name}`, `Installing ${tool.name}`, "pending")
  ui.step("clone", "Downloading Miles", "pending")
  ui.step("sync", "Setting up Python", "pending")
  if (wantPlugins) ui.step("plugins-pack", "Downloading plugins", "pending")
  for (const tool of toInstall) await installTool(tool, ui)
  await clone(root, version, ui)
  await sync(root, ui)
  if (wantPlugins) {
    try {
      await clonePlugins(ui)
    } catch (error) {
      await ui.notice(`${(error as Error).message} Miles will work without them. You can add them later with: git clone ${PLUGINS_REPO} ${pluginsDir()}`)
    }
  }
}


export function compareVersions(a: string, b: string): number {
  const parts = (v: string): number[] => v.replace(/^v/, "").split("-")[0].split(".").map((n) => parseInt(n, 10) || 0)
  const [x, y] = [parts(a), parts(b)]
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const difference = (x[i] ?? 0) - (y[i] ?? 0)
    if (difference) return difference
  }
  return 0
}

async function git(root: string, args: string[]): Promise<{ code: number; lines: string[] }> {
  const lines: string[] = []
  const code = await run("git", args, { cwd: root, onLine: (line) => lines.push(line) }).catch(() => 1)
  return { code, lines }
}

export async function cloneVersion(root: string): Promise<string | null> {
  const { code, lines } = await git(root, ["describe", "--tags", "--exact-match"])
  return code === 0 && lines[0] ? lines[0].trim() : null
}

async function updateServer(root: string, tag: string, previous: string | null, ui: InstallUI): Promise<void> {
  const fetching = `Downloading ${tag}`
  ui.step("update-fetch", fetching, "active", 0)
  const onLine = (line: string): void => {
    const match = /Receiving objects:\s+(\d+)%/.exec(line)
    if (match) ui.step("update-fetch", fetching, "active", Number(match[1]) / 100)
    else ui.log(line)
  }
  const fetched = await run("git", ["fetch", "--depth", "1", "--progress", "origin", `+refs/tags/${tag}:refs/tags/${tag}`], { cwd: root, onLine }).catch(() => 1)
  if (fetched !== 0) throw new Error(`Couldn't download ${tag}. Check your internet connection.`)
  ui.step("update-fetch", fetching, "done", 1)

  ui.step("update-apply", "Applying the update", "active", -1)
  const switched = await git(root, ["-c", "advice.detachedHead=false", "checkout", "--quiet", tag])
  if (switched.code !== 0) throw new Error(`Couldn't switch to ${tag}.`)
  ui.step("update-apply", "Applying the update", "done", 1)

  try {
    await sync(root, ui)
  } catch (error) {
    if (previous) await git(root, ["-c", "advice.detachedHead=false", "checkout", "--quiet", previous])
    throw error
  }
}

export async function ensureCurrent(ui: InstallUI, root: string, version: string): Promise<void> {
  if (DRY) return ui.log("[dry run] would check that the server matches this app")
  const wanted = `v${version}`
  const have = await cloneVersion(root)
  if (have === wanted) return
  const label = have ?? "an unknown version"

  if (have && compareVersions(have, wanted) > 0) {
    return ui.notice(`The server in ${root} is newer (${have}) than this app (${wanted}), so they may not work well together. Update the app to match.`)
  }
  if ((await git(root, ["status", "--porcelain", "-uno"])).lines.length) {
    return ui.notice(`The server in ${root} has changes of its own, so Miles didn't update it from ${label} to ${wanted}.`)
  }

  const approved = await ui.ask(
    [
      {
        name: "Miles server",
        state: "changed",
        selected: true,
        description: `Update the downloaded server from ${label} to ${wanted}, so it matches this app.`,
        permissions: [],
        dependencies: [],
        servers: [{ name: "update", run: `git fetch ${wanted}, check it out, then run uv sync` }],
      },
    ],
    "This app needs a different server than the one on this computer. Update it now?",
  )
  if (!approved.length) {
    return ui.notice(`Miles will keep running the ${label} server, which doesn't match this app (${wanted}). Some things may not work.`)
  }
  try {
    await updateServer(root, wanted, have, ui)
  } catch (error) {
    await ui.notice(`Updating the server failed: ${(error as Error).message}\n\nMiles will start with the ${label} server, which doesn't match this app (${wanted}). Some things may not work.`)
  }
}
