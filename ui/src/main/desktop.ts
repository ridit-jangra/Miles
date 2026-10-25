import { app } from "electron"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, utimesSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

const OWN_ICON = /^miles(-[0-9a-f]{8})?\.png$/

export function installLauncher(): void {
  const appImage = process.env.APPIMAGE
  if (process.platform !== "linux" || !app.isPackaged || !appImage) return

  const data = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share")
  const entry = join(data, "applications", "miles.desktop")
  const folder = join(data, "icons", "hicolor", "512x512", "apps")
  const bytes = readFileSync(join(process.resourcesPath, "icon.png"))
  const name = `miles-${createHash("sha256").update(bytes).digest("hex").slice(0, 8)}`
  const icon = join(folder, `${name}.png`)
  const text = [
    "[Desktop Entry]",
    "Type=Application",
    "Name=Miles",
    "Comment=A voice assistant on your own machine",
    `Exec="${appImage}" %U`,
    `Icon=${name}`,
    "Terminal=false",
    "Categories=Utility;",
    "StartupWMClass=Miles",
    "",
  ].join("\n")

  if (existsSync(entry) && readFileSync(entry, "utf8") === text && existsSync(icon)) return
  mkdirSync(dirname(entry), { recursive: true })
  mkdirSync(folder, { recursive: true })
  if (!existsSync(icon)) {
    writeFileSync(`${icon}.tmp`, bytes)
    renameSync(`${icon}.tmp`, icon)
  }
  for (const file of readdirSync(folder)) {
    if (OWN_ICON.test(file) && file !== `${name}.png`) rmSync(join(folder, file), { force: true })
  }
  writeFileSync(entry, text)
  const now = new Date()
  utimesSync(folder, now, now)
}
