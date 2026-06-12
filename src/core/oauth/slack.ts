import { createServer } from 'https'
import { randomBytes } from 'crypto'
import { generate } from 'selfsigned'
import { SLACK_REDIRECT_PORT, SLACK_REDIRECT_URI, type SlackOAuthResult } from '../../shared/oauth'

const AUTHORIZE_URL = 'https://slack.com/oauth/v2/authorize'
const TOKEN_URL = 'https://slack.com/api/oauth.v2.access'

const SCOPES = [
  'channels:history',
  'channels:read',
  'chat:write',
  'reactions:write',
  'users:read',
  'users.profile:read',
  'groups:read'
].join(',')

function credentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.SLACK_CLIENT_ID
  const clientSecret = process.env.SLACK_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error(
      'SLACK_CLIENT_ID / SLACK_CLIENT_SECRET are not set. Create a Slack app, add the OAuth redirect ' +
        `URL ${SLACK_REDIRECT_URI}, and set both values in the environment.`
    )
  }
  return { clientId, clientSecret }
}

async function localhostCert(): Promise<{ key: string; cert: string }> {
  const pems = await generate([{ name: 'commonName', value: 'localhost' }], {
    keySize: 2048,
    algorithm: 'sha256',
    notAfterDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    extensions: [
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 7, ip: '127.0.0.1' }
        ]
      }
    ]
  })
  return { key: pems.private, cert: pems.cert }
}

const DONE_HTML = (msg: string): string =>
  `<!doctype html><meta charset="utf-8"><title>Echo</title>` +
  `<body style="font-family:system-ui;background:#0a0a0a;color:#fff;display:grid;place-items:center;height:100vh;margin:0">` +
  `<p style="opacity:.8">${msg}</p></body>`

export async function runSlackOAuth(openUrl: (url: string) => void): Promise<SlackOAuthResult> {
  const { clientId, clientSecret } = credentials()
  const state = randomBytes(16).toString('hex')
  const { key, cert } = await localhostCert()

  return new Promise<SlackOAuthResult>((resolve, reject) => {
    const server = createServer({ key, cert })
    let settled = false

    const finish = (fn: () => void): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      server.close()
      fn()
    }

    const timer = setTimeout(
      () => finish(() => reject(new Error('Timed out waiting for Slack authorization.'))),
      5 * 60 * 1000
    )

    server.on('error', (err) => finish(() => reject(err)))

    server.on('request', async (req, res) => {
      const url = new URL(req.url ?? '/', SLACK_REDIRECT_URI)
      if (url.pathname !== '/slack/callback') {
        res.writeHead(404).end()
        return
      }

      const respond = (msg: string): void => {
        res.writeHead(200, { 'Content-Type': 'text/html' }).end(DONE_HTML(msg))
      }

      const error = url.searchParams.get('error')
      if (error) {
        respond('Authorization cancelled. You can close this window.')
        finish(() => reject(new Error(`Slack authorization failed: ${error}`)))
        return
      }
      if (url.searchParams.get('state') !== state) {
        respond('Something went wrong. You can close this window.')
        finish(() => reject(new Error('State mismatch during Slack OAuth.')))
        return
      }

      const code = url.searchParams.get('code')
      if (!code) {
        respond('No authorization code received. You can close this window.')
        finish(() => reject(new Error('No code returned from Slack.')))
        return
      }

      try {
        const tokenRes = await fetch(TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: SLACK_REDIRECT_URI
          })
        })
        const data = await tokenRes.json()
        if (!data.ok) throw new Error(data.error || 'Slack token exchange failed')

        respond('Connected to Slack. You can close this window and return to Echo.')
        finish(() => resolve({ botToken: data.access_token, teamId: data.team?.id ?? '' }))
      } catch (err) {
        respond('Token exchange failed. You can close this window.')
        finish(() => reject(err instanceof Error ? err : new Error(String(err))))
      }
    })

    server.listen(SLACK_REDIRECT_PORT, '127.0.0.1', () => {
      const authorizeUrl =
        `${AUTHORIZE_URL}?client_id=${encodeURIComponent(clientId)}` +
        `&scope=${encodeURIComponent(SCOPES)}` +
        `&redirect_uri=${encodeURIComponent(SLACK_REDIRECT_URI)}` +
        `&state=${state}`
      openUrl(authorizeUrl)
    })
  })
}
