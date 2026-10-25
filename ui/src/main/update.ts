import { app } from "electron"
import { autoUpdater } from "electron-updater"

const feed = process.env.MILES_UPDATE_URL
let configured = false

export function updatesEnabled(): boolean {
  if (process.env.MILES_NO_UPDATE || !app.isPackaged) return false
  return process.platform !== "linux" || !!process.env.APPIMAGE
}

function configure(): void {
  if (configured) return
  configured = true
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowDowngrade = false
  autoUpdater.logger = { info() {}, warn() {}, debug() {}, error: (message) => console.error(message) }
  if (feed) autoUpdater.setFeedURL({ provider: "generic", url: feed })
}

export async function findAppUpdate(): Promise<string | null> {
  if (!updatesEnabled()) return null
  configure()
  try {
    const result = await autoUpdater.checkForUpdates()
    return result?.isUpdateAvailable ? result.updateInfo.version : null
  } catch (error) {
    console.error("Couldn't check for updates:", error)
    return null
  }
}

export async function downloadAppUpdate(onProgress: (fraction: number) => void): Promise<void> {
  const listener = (progress: { percent: number }): void => onProgress(progress.percent / 100)
  autoUpdater.on("download-progress", listener)
  try {
    await autoUpdater.downloadUpdate()
  } finally {
    autoUpdater.off("download-progress", listener)
  }
}

export function installAppUpdate(): void {
  autoUpdater.quitAndInstall(false, true)
}
