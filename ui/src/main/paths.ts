import { homedir } from "node:os"
import { delimiter, join } from "node:path"

export const milesHome = (): string => process.env.MILES_HOME || join(homedir(), ".miles")

export function serverRoot(app: { isPackaged: boolean; getAppPath(): string }): string {
  if (process.env.MILES_ROOT) return process.env.MILES_ROOT
  if (!app.isPackaged && !process.env.MILES_FORCE_INSTALL) return join(app.getAppPath(), "..")
  return join(milesHome(), "app")
}

export function toolEnv(): NodeJS.ProcessEnv {
  const extra = [join(homedir(), ".local", "bin"), join(homedir(), ".bun", "bin")]
  return {...process.env, PATH: [...extra, process.env.PATH ?? ""].join(delimiter)}
}

export function isManaged(app: { isPackaged: boolean }): boolean {
  return !process.env.MILES_ROOT && (app.isPackaged || !!process.env.MILES_FORCE_INSTALL)
}
