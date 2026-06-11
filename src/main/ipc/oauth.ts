import { ipcMain } from 'electron'
import { GITHUB_OAUTH_POLL, GITHUB_OAUTH_START } from '../../shared/channels'
import { pollGithubDeviceToken, startGithubDeviceFlow } from '../../core/oauth/github'

ipcMain.handle(GITHUB_OAUTH_START, () => startGithubDeviceFlow())

ipcMain.handle(GITHUB_OAUTH_POLL, (_e, deviceCode: string, interval: number) =>
  pollGithubDeviceToken(deviceCode, interval)
)
