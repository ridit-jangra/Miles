import { existsSync, readdirSync, rmSync } from "node:fs"
import { homedir } from "node:os"
import { join, parse, resolve } from "node:path"

import { milesHome } from "./paths"

export type UninstallMode = "program" | "everything"
export type UninstallPlan = { remove: string[]; keep: string[]; problem?: string }

const dataHome = (): string => process.env.XDG_DATA_HOME || join(homedir(), ".local", "share")
const cacheHome = (): string => process.env.XDG_CACHE_HOME || join(homedir(), ".cache")

export function launcherFiles(): string[] {
  return [join(dataHome(), "applications", "miles.desktop"), join(dataHome(), "icons", "hicolor", "512x512", "apps", "miles.png")]
}

export function modelFolders(): string[] {
  const hub = join(cacheHome(), "huggingface", "hub")
  const whisper = existsSync(hub) ? readdirSync(hub).filter((name) => name.startsWith("models--Systran--faster-whisper-")).map((name) => join(hub, name)) : []
  return [join(cacheHome(), "pipecat"), ...whisper]
}

function unsafe(home: string): string | undefined {
  const dir = resolve(home)
  const here = resolve(homedir())
  if (dir === parse(dir).root || dir === here || here.startsWith(dir + "/")) {
    return `${dir} is your home folder or a folder above it, so it won't be deleted. Set MILES_HOME to a folder of its own.`
  }
  return undefined
}

export function planUninstall(mode: UninstallMode, models: boolean, userData?: string): UninstallPlan {
  const home = resolve(milesHome())
  const problem = unsafe(home)
  if (problem) return { remove: [], keep: [], problem }
  const programOnly = [join(home, "app"), join(home, "deps"), join(home, "warm")]
  const remove = mode === "everything" ? [home, ...(userData ? [userData] : [])] : programOnly
  remove.push(...launcherFiles())
  if (models) remove.push(...modelFolders())
  const keep = mode === "everything" || !existsSync(home) ? [] : readdirSync(home).filter((name) => !["app", "deps", "warm"].includes(name))
  return { remove: remove.filter((path) => existsSync(path)), keep }
}

export function runUninstall(plan: UninstallPlan): string[] {
  const failed: string[] = []
  for (const path of plan.remove) {
    try {
      rmSync(path, { recursive: true, force: true })
    } catch {
      failed.push(path)
    }
  }
  return failed
}
