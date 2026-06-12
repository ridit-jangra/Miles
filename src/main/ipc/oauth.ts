import { ipcMain, shell } from 'electron'
import { GITHUB_OAUTH_POLL, GITHUB_OAUTH_START, SLACK_OAUTH } from '../../shared/channels'
import { pollGithubDeviceToken, startGithubDeviceFlow } from '../../core/oauth/github'
import { runSlackOAuth } from '../../core/oauth/slack'

ipcMain.handle(GITHUB_OAUTH_START, () => startGithubDeviceFlow())

ipcMain.handle(GITHUB_OAUTH_POLL, (_e, deviceCode: string, interval: number) =>
  pollGithubDeviceToken(deviceCode, interval)
)

ipcMain.handle(SLACK_OAUTH, () => runSlackOAuth((url) => shell.openExternal(url)))
