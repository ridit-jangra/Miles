import { Check, Eye, EyeOff, Loader2 } from 'lucide-react'
import React from 'react'

const inputClass =
  'bg-neutral-900 border border-white/10 rounded-md px-3 py-2 outline-none focus:border-white/30 transition-colors w-full pr-10'

export function Settings(): React.JSX.Element {
  const [key, setKey] = React.useState('')
  const [savedKey, setSavedKey] = React.useState('')
  const [show, setShow] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let active = true
    window.settings.get().then((s) => {
      if (!active) return
      setKey(s.OPENROUTER_API_KEY)
      setSavedKey(s.OPENROUTER_API_KEY)
    })
    return () => {
      active = false
    }
  }, [])

  const dirty = key.trim() !== savedKey

  const save = async (): Promise<void> => {
    if (!dirty || saving) return
    setSaving(true)
    setError(null)
    try {
      const trimmed = key.trim()
      await window.settings.set({ OPENROUTER_API_KEY: trimmed })
      setSavedKey(trimmed)
      setKey(trimmed)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 w-full min-h-screen pt-20 px-5 pl-25">
      <div>
        <h1 className="text-2xl">Settings</h1>
        <p className="text-white/60">Configure how Miles works.</p>
      </div>

      <div className="bg-[#171717] rounded-md p-6 flex flex-col gap-4 max-w-2xl">
        <span>
          <p className="text-lg">OpenRouter API key</p>
          <p className="text-white/70">
            Powers the chat model and screen vision. Stored locally on this machine.
          </p>
        </span>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-white/70">API key</span>
          <span className="relative">
            <input
              className={inputClass}
              type={show ? 'text' : 'password'}
              value={key}
              placeholder="sk-or-v1-..."
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save()
              }}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white cursor-pointer transition-colors"
              onClick={() => setShow((v) => !v)}
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>

        <a
          href="https://openrouter.ai/settings/keys"
          target="_blank"
          rel="noreferrer"
          className="text-sm text-white/50 hover:text-white transition-colors underline"
        >
          Where do I find this?
        </a>

        {error && <p className="text-sm text-red-300 wrap-break-word">{error}</p>}

        <span className="h-px w-full bg-white/15" />

        <span className="flex justify-end items-center gap-3 mt-2">
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-300">
              <Check size={16} />
              Saved
            </span>
          )}
          <button
            className="flex items-center gap-2 px-6 py-2 rounded-md bg-white/10 hover:bg-white/15 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={save}
            disabled={!dirty || saving}
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            Save
          </button>
        </span>
      </div>
    </div>
  )
}
