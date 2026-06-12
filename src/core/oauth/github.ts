import type { GithubDeviceStart } from '../../shared/oauth'

const DEVICE_CODE_URL = 'https://github.com/login/device/code'
const TOKEN_URL = 'https://github.com/login/oauth/access_token'

const SCOPE = 'repo read:org read:user'

const JSON_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json'
}

function clientId(): string {
  const id = process.env.GITHUB_CLIENT_ID
  if (!id || id === 'REPLACE_WITH_YOUR_CLIENT_ID') {
    throw new Error(
      'No GitHub client ID configured. Set DEFAULT_CLIENT_ID in src/core/oauth/github.ts (or the GITHUB_CLIENT_ID env var) to a GitHub OAuth app with Device Flow enabled.'
    )
  }
  return id
}

export async function startGithubDeviceFlow(): Promise<GithubDeviceStart> {
  const res = await fetch(DEVICE_CODE_URL, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ client_id: clientId(), scope: SCOPE })
  })
  if (!res.ok) throw new Error(`GitHub device code request failed (${res.status})`)

  const data = await res.json()
  if (data.error) throw new Error(data.error_description || data.error)

  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    interval: data.interval ?? 5,
    expiresIn: data.expires_in ?? 900
  }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export async function pollGithubDeviceToken(deviceCode: string, interval: number): Promise<string> {
  let waitMs = Math.max(interval, 1) * 1000
  const deadline = Date.now() + 15 * 60 * 1000

  while (Date.now() < deadline) {
    await sleep(waitMs)

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        client_id: clientId(),
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
      })
    })
    const data = await res.json()

    if (data.access_token) return data.access_token

    switch (data.error) {
      case 'authorization_pending':
        break
      case 'slow_down':
        waitMs += 5000
        break
      case 'expired_token':
        throw new Error('The code expired before you authorized. Please try again.')
      case 'access_denied':
        throw new Error('Authorization was denied.')
      default:
        throw new Error(data.error_description || data.error || 'GitHub authorization failed')
    }
  }

  throw new Error('Timed out waiting for GitHub authorization.')
}
