import { Check, Copy, ExternalLink, Loader2, X } from 'lucide-react'
import React from 'react'
import type { MCPServerState } from '../../../shared/mcp'
import { CATALOG, type CatalogApp } from '../lib/integrations'
import { cn } from '../lib/utils'

const STATUS_LABEL: Record<MCPServerState['status'], string> = {
  connected: 'Connected',
  connecting: 'Connecting…',
  disconnected: 'Not connected',
  error: 'Error'
}

const STATUS_DOT: Record<MCPServerState['status'], string> = {
  connected: 'bg-emerald-300',
  connecting: 'bg-amber-300 animate-pulse',
  disconnected: 'bg-white/30',
  error: 'bg-red-400'
}

interface AppCardProps {
  app: CatalogApp
  server?: MCPServerState
  busy: boolean
  onConnect: () => void
  onDisconnect: () => void
  onRemove: () => void
}

function AppCard({
  app,
  server,
  busy,
  onConnect,
  onDisconnect,
  onRemove
}: AppCardProps): React.JSX.Element {
  const status = server?.status
  const isConnected = status === 'connected'
  const isLive = !!server && status !== 'disconnected'

  return (
    <div className="bg-white/5 rounded-md p-6 flex flex-col gap-4">
      <span className="flex items-start justify-between">
        {app.icon}
        {server && status && status !== 'disconnected' && (
          <span className="flex items-center gap-2 text-sm text-white/70">
            <span className={cn('w-2.5 h-2.5 rounded-full inline-block', STATUS_DOT[status])} />
            {STATUS_LABEL[status]}
          </span>
        )}
      </span>

      <span className="mb-1">
        <p className="text-lg">{app.name}</p>
        <p className="text-white/70">{app.description}</p>
      </span>

      {status === 'connected' && server && (
        <p className="text-sm text-white/50">
          {server.tools.length} tool{server.tools.length === 1 ? '' : 's'} available
        </p>
      )}
      {status === 'error' && server?.error && (
        <p className="text-sm text-red-300 break-words line-clamp-3">{server.error}</p>
      )}

      <span className="h-px w-full bg-white/15" />

      <span className="flex justify-end gap-2 mt-2">
        {isLive && (
          <button
            className="px-4 py-2 rounded-md cursor-pointer text-white/50 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
            onClick={onRemove}
            disabled={busy}
          >
            Remove
          </button>
        )}
        <button
          className="flex items-center gap-2 px-6 py-2 rounded-md bg-white/10 hover:bg-white/15 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={isConnected ? onDisconnect : onConnect}
          disabled={busy}
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          {isConnected ? 'Disconnect' : isLive ? 'Reconnect' : 'Connect'}
        </button>
      </span>
    </div>
  )
}

const inputClass =
  'bg-white/5 border border-white/10 rounded-md px-3 py-2 outline-none focus:border-white/30 transition-colors w-full'

interface ConnectModalProps {
  app: CatalogApp
  onClose: () => void
  onSubmit: (values: Record<string, string>) => Promise<void>
}

function ConnectModal({ app, onClose, onSubmit }: ConnectModalProps): React.JSX.Element {
  const [values, setValues] = React.useState<Record<string, string>>({})
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const valid = app.fields.every((f) => values[f.key]?.trim())

  const submit = async (): Promise<void> => {
    if (!valid || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const trimmed: Record<string, string> = {}
      for (const f of app.fields) trimmed[f.key] = values[f.key].trim()
      await onSubmit(trimmed)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-200 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-neutral-900 border border-white/10 rounded-md w-full max-w-md p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="flex items-center justify-between">
          <span className="flex items-center gap-3">
            {app.icon}
            <h2 className="text-xl">Connect {app.name}</h2>
          </span>
          <button className="text-white/60 hover:text-white cursor-pointer" onClick={onClose}>
            <X />
          </button>
        </span>

        {app.fields.map((field) => (
          <label key={field.key} className="flex flex-col gap-1">
            <span className="text-sm text-white/70">{field.label}</span>
            <input
              className={inputClass}
              type={field.secret ? 'password' : 'text'}
              value={values[field.key] ?? ''}
              placeholder={field.placeholder}
              autoComplete="off"
              onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
            />
          </label>
        ))}

        {app.helpUrl && (
          <a
            href={app.helpUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-white/50 hover:text-white transition-colors underline"
          >
            Where do I find this?
          </a>
        )}

        {error && <p className="text-sm text-red-300 break-words">{error}</p>}

        <button
          className="bg-white/10 hover:bg-white/15 px-6 py-2 rounded-md cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
          onClick={submit}
          disabled={!valid || submitting}
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          Connect
        </button>
      </div>
    </div>
  )
}

interface OAuthModalProps {
  app: CatalogApp
  onClose: () => void
  onSubmit: (values: Record<string, string>) => Promise<void>
}

/** GitHub device-flow: show the user code, open the browser, poll for the token. */
function GithubOAuthModal({ app, onClose, onSubmit }: OAuthModalProps): React.JSX.Element {
  const [userCode, setUserCode] = React.useState<string | null>(null)
  const [verificationUri, setVerificationUri] = React.useState('')
  const [phase, setPhase] = React.useState<'starting' | 'waiting' | 'done'>('starting')
  const [error, setError] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    window.oauth
      .githubStart()
      .then((start) => {
        if (cancelled) return undefined
        setUserCode(start.userCode)
        setVerificationUri(start.verificationUri)
        setPhase('waiting')
        return window.oauth.githubPoll(start.deviceCode, start.interval)
      })
      .then(async (token) => {
        if (cancelled || !token) return
        await onSubmit({ [app.oauth!.tokenKey]: token })
        if (!cancelled) {
          setPhase('done')
          onClose()
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const copy = (): void => {
    if (!userCode) return
    navigator.clipboard.writeText(userCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      className="fixed inset-0 z-200 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-neutral-900 border border-white/10 rounded-md w-full max-w-md p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="flex items-center justify-between">
          <span className="flex items-center gap-3">
            {app.icon}
            <h2 className="text-xl">Connect {app.name}</h2>
          </span>
          <button className="text-white/60 hover:text-white cursor-pointer" onClick={onClose}>
            <X />
          </button>
        </span>

        {error ? (
          <p className="text-sm text-red-300 break-words">{error}</p>
        ) : phase === 'starting' ? (
          <span className="flex items-center gap-2 text-white/70 py-4">
            <Loader2 size={16} className="animate-spin" />
            Starting authorization…
          </span>
        ) : (
          <>
            <p className="text-white/70 text-sm">Enter this code on GitHub to authorize Echo:</p>
            <button
              onClick={copy}
              className="flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md py-3 font-mono text-2xl tracking-[0.3em] cursor-pointer transition-colors"
            >
              {userCode}
              {copied ? (
                <Check size={18} className="text-emerald-300" />
              ) : (
                <Copy size={18} className="text-white/50" />
              )}
            </button>
            <a
              href={verificationUri}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 px-6 py-2 rounded-md transition-colors"
            >
              <ExternalLink size={16} />
              Open GitHub
            </a>
            <span className="flex items-center gap-2 text-white/50 text-sm justify-center">
              <Loader2 size={14} className="animate-spin" />
              Waiting for authorization…
            </span>
          </>
        )}
      </div>
    </div>
  )
}

export function Integrations(): React.JSX.Element {
  const [servers, setServers] = React.useState<MCPServerState[]>([])
  const [busy, setBusy] = React.useState<Set<string>>(new Set())
  const [connecting, setConnecting] = React.useState<CatalogApp | null>(null)

  React.useEffect(() => {
    let active = true
    window.mcp.list().then((list) => {
      if (active) setServers(list)
    })
    return () => {
      active = false
    }
  }, [])

  /** Match a catalog app to its configured server by name. */
  const serverFor = (app: CatalogApp): MCPServerState | undefined =>
    servers.find((s) => s.name === app.name)

  const markBusy = (id: string, on: boolean): void =>
    setBusy((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  const upsert = (state: MCPServerState): void =>
    setServers((prev) => {
      const exists = prev.some((s) => s.id === state.id)
      return exists ? prev.map((s) => (s.id === state.id ? state : s)) : [...prev, state]
    })

  const connect = async (app: CatalogApp, values: Record<string, string>): Promise<void> => {
    markBusy(app.id, true)
    try {
      const state = await window.mcp.add(app.build(values))
      upsert(state)
    } finally {
      markBusy(app.id, false)
    }
  }

  const reconnect = async (app: CatalogApp, server: MCPServerState): Promise<void> => {
    markBusy(app.id, true)
    try {
      upsert(await window.mcp.update(server.id, { enabled: true }))
    } catch (err) {
      console.error('[MCP] reconnect failed:', err)
    } finally {
      markBusy(app.id, false)
    }
  }

  const disconnect = async (app: CatalogApp, server: MCPServerState): Promise<void> => {
    markBusy(app.id, true)
    try {
      upsert(await window.mcp.update(server.id, { enabled: false }))
    } catch (err) {
      console.error('[MCP] disconnect failed:', err)
    } finally {
      markBusy(app.id, false)
    }
  }

  const remove = async (app: CatalogApp, server: MCPServerState): Promise<void> => {
    if (!confirm(`Remove ${app.name}?`)) return
    markBusy(app.id, true)
    try {
      await window.mcp.remove(server.id)
      setServers((prev) => prev.filter((s) => s.id !== server.id))
    } catch (err) {
      console.error('[MCP] remove failed:', err)
    } finally {
      markBusy(app.id, false)
    }
  }

  return (
    <div className="flex flex-col gap-5 w-full h-screen pt-20 px-5 pl-25 overflow-y-auto">
      <div>
        <h1 className="text-2xl">Integrations</h1>
        <p className="text-white/60">Connect your apps to give Echo more to work with.</p>
      </div>

      <div className="grid grid-cols-2 gap-5 pb-10">
        {CATALOG.map((app) => {
          const server = serverFor(app)
          return (
            <AppCard
              key={app.id}
              app={app}
              server={server}
              busy={busy.has(app.id)}
              onConnect={() => {
                if (server) reconnect(app, server)
                else setConnecting(app)
              }}
              onDisconnect={() => server && disconnect(app, server)}
              onRemove={() => server && remove(app, server)}
            />
          )
        })}
      </div>

      {connecting &&
        (connecting.oauth?.provider === 'github' ? (
          <GithubOAuthModal
            app={connecting}
            onClose={() => setConnecting(null)}
            onSubmit={(values) => connect(connecting, values)}
          />
        ) : (
          <ConnectModal
            app={connecting}
            onClose={() => setConnecting(null)}
            onSubmit={(values) => connect(connecting, values)}
          />
        ))}
    </div>
  )
}
