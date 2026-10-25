import { app } from "electron"
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

export function installLauncher(): void {
  const appImage = process.env.APPIMAGE
  if (process.platform !== "linux" || !app.isPackaged || !appImage) return

  const data = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share")
  const entry = join(data, "applications", "miles.desktop")
  const icon = join(data, "icons", "hicolor", "512x512", "apps", "miles.png")
  const text = [
    "[Desktop Entry]",
    "Type=Application",
    "Name=Miles",
    "Comment=A voice assistant on your own machine",
    `Exec="${appImage}" %U`,
    "Icon=miles",
    "Terminal=false",
    "Categories=Utility;",
    "StartupWMClass=Miles",
    "",
  ].join("\n")

  if (existsSync(entry) && readFileSync(entry, "utf8") === text && existsSync(icon)) return
  mkdirSync(dirname(entry), { recursive: true })
  mkdirSync(dirname(icon), { recursive: true })
  copyFileSync(join(process.resourcesPath, "icon.png"), icon)
  writeFileSync(entry, text)
}
